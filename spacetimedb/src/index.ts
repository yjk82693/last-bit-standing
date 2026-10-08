import { schema, t, table, SenderError, type InferSchema, type ReducerCtx } from "spacetimedb/server";
import type { Identity } from "spacetimedb";
import { CARDS, PROMPTS } from "../../src/lib/catalog";
import { START_RATING } from "./rating";

// ---------- Catalog + scores (from the hackathon build) ----------

const card = table(
  { name: "card", public: true },
  {
    id: t.string().primaryKey(),
    encoding: t.string(),
    glyph: t.string(),
    value: t.u32(),
    name: t.string(),
    flavor: t.string(),
    rarity: t.string(),
  },
);

const prompt = table(
  { name: "prompt", public: true },
  {
    id: t.string().primaryKey(),
    text: t.string(),
    answer: t.string(),
    category: t.string(),
    difficulty: t.string(),
    hint: t.string(),
  },
);

const score = table(
  { name: "score", public: true },
  {
    id: t.string().primaryKey(),
    name: t.string(),
    won: t.bool(),
    rounds: t.u32(),
    health: t.u32(),
    score: t.u32(),
    correctCalls: t.u32(),
    falseCalls: t.u32(),
    at: t.string(),
  },
);

// ---------- Multiplayer lobby ----------

// Public profile + multiplayer stats. Everyone in the lobby can read this,
// so it never holds the email.
const player = table(
  { name: "player", public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.string(),
    online: t.bool(),
    registered: t.bool(),
    rating: t.u32(),
    matches: t.u32(),
    wins: t.u32(),
    correctAnswers: t.u32(),
    totalAnswers: t.u32(),
  },
);

// Private: only reducers can read it. Links an identity to its email.
const account = table(
  { name: "account" },
  {
    identity: t.identity().primaryKey(),
    email: t.string(),
    createdAt: t.timestamp(),
  },
);

// kind: "quick" (preset 2/3/4, matchmade) | "custom" (host-configured)
// visibility: "public" (listed in lobby) | "private" (code only)
// phase: "waiting" | "playing" | "finished"
const room = table(
  { name: "room", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    code: t.string().unique(),
    name: t.string(),
    kind: t.string(),
    visibility: t.string(),
    capacity: t.u8(),
    host: t.identity(),
    phase: t.string(),
    createdAt: t.timestamp(),
  },
);

const seat = table(
  { name: "seat", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64().index("btree"),
    identity: t.identity().index("btree"),
    seatIndex: t.u8(),
    ready: t.bool(),
    health: t.u8(),
    eliminated: t.bool(),
  },
);

// Private: a guest asks to link, the code is kept in their browser, and
// after they sign in the account presents it to claim the guest record.
const guest_link = table(
  { name: "guest_link" },
  {
    code: t.string().primaryKey(),
    guest: t.identity(),
    createdAt: t.timestamp(),
  },
);

const spacetimedb = schema({ card, prompt, score, player, account, guest_link, room, seat });
export default spacetimedb;

const QUICK_SIZES = [2, 3, 4];
const CUSTOM_MIN = 2;
const CUSTOM_MAX = 6;
const START_HEALTH = 3;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const GUEST_ID_CHARS = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const LINK_TTL_MICROS = 60n * 60n * 1_000_000n; // a link code lasts one hour

// Tokens from this issuer count as a registered (email) account.
// Anonymous connections still get a SpacetimeDB-issued token, so we
// check the issuer rather than just "has a JWT".
const AUTH_ISSUER = "https://auth.spacetimedb.com/oidc";

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;

function signedInEmail(ctx: Ctx): string | null {
  const jwt = ctx.senderAuth.jwt;
  if (!jwt || jwt.issuer !== AUTH_ISSUER) return null;
  const email = jwt.fullPayload["email"];
  return typeof email === "string" && email.length > 0 ? email : null;
}

function requireAccount(ctx: Ctx) {
  if (!ctx.db.account.identity.find(ctx.sender)) {
    throw new SenderError("Sign in to an account first");
  }
}

function newGuestId(ctx: Ctx): string {
  const taken = new Set([...ctx.db.player.iter()].map((p) => p.name));
  for (let attempt = 0; attempt < 50; attempt++) {
    let id = "id";
    for (let i = 0; i < 5; i++) {
      id += GUEST_ID_CHARS[ctx.random.integerInRange(0, GUEST_ID_CHARS.length - 1)];
    }
    if (!taken.has(id)) return id;
  }
  throw new SenderError("Could not generate a guest ID, try again");
}

function dropLinksFor(ctx: Ctx, guest: Identity) {
  for (const l of [...ctx.db.guest_link.iter()]) {
    if (l.guest.isEqual(guest)) ctx.db.guest_link.code.delete(l.code);
  }
}

function seatsIn(ctx: Ctx, roomId: bigint) {
  return [...ctx.db.seat.roomId.filter(roomId)];
}

function currentSeat(ctx: Ctx) {
  for (const s of ctx.db.seat.identity.filter(ctx.sender)) {
    const r = ctx.db.room.id.find(s.roomId);
    if (r && r.phase !== "finished") return { seat: s, room: r };
  }
  return null;
}

function newCode(ctx: Ctx): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = "";
    for (let i = 0; i < 5; i++) {
      code += CODE_CHARS[ctx.random.integerInRange(0, CODE_CHARS.length - 1)];
    }
    if (!ctx.db.room.code.find(code)) return code;
  }
  throw new SenderError("Could not generate a room code, try again");
}

function nextSeatIndex(ctx: Ctx, roomId: bigint): number {
  const taken = new Set(seatsIn(ctx, roomId).map((s) => s.seatIndex));
  let i = 0;
  while (taken.has(i)) i++;
  return i;
}

function sit(ctx: Ctx, roomId: bigint) {
  ctx.db.seat.insert({
    id: 0n,
    roomId,
    identity: ctx.sender,
    seatIndex: nextSeatIndex(ctx, roomId),
    ready: false,
    health: START_HEALTH,
    eliminated: false,
  });
}

function makeRoom(
  ctx: Ctx,
  kind: string,
  visibility: string,
  capacity: number,
  name: string,
) {
  const r = ctx.db.room.insert({
    id: 0n,
    code: newCode(ctx),
    name,
    kind,
    visibility,
    capacity,
    host: ctx.sender,
    phase: "waiting",
    createdAt: ctx.timestamp,
  });
  sit(ctx, r.id);
  return r;
}

// Removes the caller from a waiting room, handing off host or deleting empty rooms.
function vacate(ctx: Ctx, identity = ctx.sender) {
  for (const s of [...ctx.db.seat.identity.filter(identity)]) {
    const r = ctx.db.room.id.find(s.roomId);
    if (!r || r.phase !== "waiting") continue;
    ctx.db.seat.id.delete(s.id);
    const rest = seatsIn(ctx, r.id);
    if (rest.length === 0) {
      ctx.db.room.id.delete(r.id);
    } else if (r.host.isEqual(identity)) {
      const heir = rest.sort((a, b) => a.seatIndex - b.seatIndex)[0]!;
      ctx.db.room.id.update({ ...r, host: heir.identity });
    }
  }
}

function joinExisting(ctx: Ctx, r: { id: bigint; phase: string; capacity: number }) {
  if (r.phase !== "waiting") throw new SenderError("That match already started");
  if (seatsIn(ctx, r.id).length >= r.capacity) throw new SenderError("Room is full");
  vacate(ctx);
  sit(ctx, r.id);
}

// ---------- Lifecycle ----------

spacetimedb.init((ctx) => {
  for (const row of CARDS) {
    ctx.db.card.insert({
      id: row.id,
      encoding: row.encoding,
      glyph: row.glyph,
      value: row.value,
      name: row.name,
      flavor: row.flavor,
      rarity: row.rarity,
    });
  }
  for (const row of PROMPTS) {
    ctx.db.prompt.insert({
      id: row.id,
      text: row.text,
      answer: row.answer,
      category: row.category,
      difficulty: row.difficulty,
      hint: row.hint,
    });
  }
});

export const on_connect = spacetimedb.clientConnected((ctx) => {
  const email = signedInEmail(ctx);
  if (email) {
    const acct = ctx.db.account.identity.find(ctx.sender);
    if (acct) {
      if (acct.email !== email) ctx.db.account.identity.update({ ...acct, email });
    } else {
      ctx.db.account.insert({ identity: ctx.sender, email, createdAt: ctx.timestamp });
    }
  }
  const existing = ctx.db.player.identity.find(ctx.sender);
  if (existing) {
    ctx.db.player.identity.update({ ...existing, online: true, registered: Boolean(email) || existing.registered });
  } else {
    ctx.db.player.insert({
      identity: ctx.sender,
      // Default display name is the part of the email before "@".
      name: email ? email.split("@")[0]!.slice(0, 24) : newGuestId(ctx),
      online: true,
      registered: Boolean(email),
      rating: START_RATING,
      matches: 0,
      wins: 0,
      correctAnswers: 0,
      totalAnswers: 0,
    });
  }
});

export const on_disconnect = spacetimedb.clientDisconnected((ctx) => {
  const existing = ctx.db.player.identity.find(ctx.sender);
  if (existing) ctx.db.player.identity.update({ ...existing, online: false });
  // Seats are kept so a refresh or brief drop doesn't kick you.
  // Stale offline seats get cleaned up by a scheduled sweep (next step).
});

// ---------- Reducers ----------

export const set_name = spacetimedb.reducer({ name: t.string() }, (ctx, { name }) => {
  const clean = name.trim().slice(0, 24);
  if (!clean) throw new SenderError("Name cannot be empty");
  const p = ctx.db.player.identity.find(ctx.sender);
  if (!p) throw new SenderError("Not connected");
  ctx.db.player.identity.update({ ...p, name: clean });
});

// Joins an open public quick room of that size, or opens a new one.
export const quick_match = spacetimedb.reducer({ size: t.u8() }, (ctx, { size }) => {
  if (!QUICK_SIZES.includes(size)) throw new SenderError("Quick rooms are 2, 3, or 4 players");
  const open = [...ctx.db.room.iter()]
    .filter(
      (r) =>
        r.kind === "quick" &&
        r.visibility === "public" &&
        r.phase === "waiting" &&
        r.capacity === size &&
        seatsIn(ctx, r.id).length < r.capacity,
    )
    .sort((a, b) => Number(a.createdAt.microsSinceUnixEpoch - b.createdAt.microsSinceUnixEpoch));
  if (open[0]) {
    joinExisting(ctx, open[0]);
  } else {
    vacate(ctx);
    makeRoom(ctx, "quick", "public", size, `${size}-player table`);
  }
});

export const create_custom_room = spacetimedb.reducer(
  { name: t.string(), capacity: t.u8(), isPrivate: t.bool() },
  (ctx, { name, capacity, isPrivate }) => {
    if (capacity < CUSTOM_MIN || capacity > CUSTOM_MAX) {
      throw new SenderError(`Custom rooms seat ${CUSTOM_MIN} to ${CUSTOM_MAX}`);
    }
    vacate(ctx);
    makeRoom(
      ctx,
      "custom",
      isPrivate ? "private" : "public",
      capacity,
      name.trim().slice(0, 32) || "Custom table",
    );
  },
);

// From the lobby list (public rooms only).
export const join_room = spacetimedb.reducer({ roomId: t.u64() }, (ctx, { roomId }) => {
  const r = ctx.db.room.id.find(roomId);
  if (!r || r.visibility !== "public") throw new SenderError("Room not found");
  joinExisting(ctx, r);
});

// Works for both public and private rooms.
export const join_by_code = spacetimedb.reducer({ code: t.string() }, (ctx, { code }) => {
  const r = ctx.db.room.code.find(code.trim().toUpperCase());
  if (!r) throw new SenderError("No room with that code");
  joinExisting(ctx, r);
});

export const leave_room = spacetimedb.reducer((ctx) => {
  vacate(ctx);
});

export const set_ready = spacetimedb.reducer({ ready: t.bool() }, (ctx, { ready }) => {
  const here = currentSeat(ctx);
  if (!here || here.room.phase !== "waiting") throw new SenderError("Not in a waiting room");
  ctx.db.seat.id.update({ ...here.seat, ready });
});

// Custom-room host controls: who stays, how many seats.
export const kick = spacetimedb.reducer({ seatId: t.u64() }, (ctx, { seatId }) => {
  const here = currentSeat(ctx);
  if (!here || here.room.kind !== "custom" || !here.room.host.isEqual(ctx.sender)) {
    throw new SenderError("Only the custom room host can remove players");
  }
  const target = ctx.db.seat.id.find(seatId);
  if (!target || target.roomId !== here.room.id) throw new SenderError("Seat not in your room");
  if (target.identity.isEqual(ctx.sender)) throw new SenderError("Use leave instead");
  vacate(ctx, target.identity);
});

export const set_capacity = spacetimedb.reducer({ capacity: t.u8() }, (ctx, { capacity }) => {
  const here = currentSeat(ctx);
  if (!here || here.room.kind !== "custom" || !here.room.host.isEqual(ctx.sender)) {
    throw new SenderError("Only the custom room host can resize");
  }
  if (capacity < CUSTOM_MIN || capacity > CUSTOM_MAX) {
    throw new SenderError(`Custom rooms seat ${CUSTOM_MIN} to ${CUSTOM_MAX}`);
  }
  if (capacity < seatsIn(ctx, here.room.id).length) {
    throw new SenderError("Remove players before shrinking the room");
  }
  ctx.db.room.id.update({ ...here.room, capacity });
});

// Quick rooms auto-start when full and all ready; custom rooms start when the host says so.
export const start_match = spacetimedb.reducer((ctx) => {
  const here = currentSeat(ctx);
  if (!here || here.room.phase !== "waiting") throw new SenderError("Not in a waiting room");
  const seats = seatsIn(ctx, here.room.id);
  if (here.room.kind === "custom" && !here.room.host.isEqual(ctx.sender)) {
    throw new SenderError("Only the host can start");
  }
  if (here.room.kind === "quick" && seats.length < here.room.capacity) {
    throw new SenderError("Waiting for the table to fill");
  }
  if (seats.length < 2) throw new SenderError("Need at least 2 players");
  if (!seats.every((s) => s.ready)) throw new SenderError("Everyone must be ready");
  ctx.db.room.id.update({ ...here.room, phase: "playing" });
  // Round dealing comes in the next step.
});

// Guest, step 1: remember a secret code for this guest identity.
export const link_guest_start = spacetimedb.reducer({ code: t.string() }, (ctx, { code }) => {
  if (ctx.db.account.identity.find(ctx.sender)) throw new SenderError("Already an account");
  if (!ctx.db.player.identity.find(ctx.sender)) throw new SenderError("Not connected");
  if (code.length < 24 || code.length > 128) throw new SenderError("Bad link code");
  dropLinksFor(ctx, ctx.sender);
  ctx.db.guest_link.insert({ code, guest: ctx.sender, createdAt: ctx.timestamp });
});

// Account, step 2: move the guest's record onto this account.
export const link_guest_claim = spacetimedb.reducer({ code: t.string() }, (ctx, { code }) => {
  requireAccount(ctx);
  const link = ctx.db.guest_link.code.find(code);
  if (!link) throw new SenderError("That guest link was not found");
  ctx.db.guest_link.code.delete(code);
  const age = ctx.timestamp.microsSinceUnixEpoch - link.createdAt.microsSinceUnixEpoch;
  if (age > LINK_TTL_MICROS) throw new SenderError("That guest link expired, link again from guest settings");
  if (link.guest.isEqual(ctx.sender)) throw new SenderError("Nothing to link");
  const guest = ctx.db.player.identity.find(link.guest);
  const me = ctx.db.player.identity.find(ctx.sender);
  if (!guest || !me) throw new SenderError("Guest record is gone");
  ctx.db.player.identity.update({
    ...me,
    // A brand-new account takes the guest's rating; an existing one keeps its own.
    rating: me.matches === 0 ? guest.rating : me.rating,
    matches: me.matches + guest.matches,
    wins: me.wins + guest.wins,
    correctAnswers: me.correctAnswers + guest.correctAnswers,
    totalAnswers: me.totalAnswers + guest.totalAnswers,
  });
  vacate(ctx, link.guest);
  dropLinksFor(ctx, link.guest);
  ctx.db.player.identity.delete(link.guest);
});

// Guest leaving for good: free their seat and delete the record.
export const discard_guest = spacetimedb.reducer((ctx) => {
  if (ctx.db.account.identity.find(ctx.sender)) throw new SenderError("Accounts are not discarded");
  vacate(ctx);
  dropLinksFor(ctx, ctx.sender);
  ctx.db.player.identity.delete(ctx.sender);
});

export const record_score = spacetimedb.reducer(
  {
    id: t.string(),
    name: t.string(),
    won: t.bool(),
    rounds: t.u32(),
    health: t.u32(),
    score: t.u32(),
    correctCalls: t.u32(),
    falseCalls: t.u32(),
    at: t.string(),
  },
  (ctx, args) => {
    ctx.db.score.insert(args);
  },
);