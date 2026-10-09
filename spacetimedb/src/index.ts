import { schema, t, table, SenderError, type InferSchema, type ReducerCtx } from "spacetimedb/server";
import { ScheduleAt, Timestamp, type Identity } from "spacetimedb";
import { roundTimerMs } from "../../src/lib/bots";
import { roundScore } from "../../src/lib/scoring";
import type { CardDef } from "../../src/lib/types";
import { dealHand, isCorrect, pickPrompt, promptById } from "./cards";
import { CARDS, PROMPTS } from "../../src/lib/catalog";
import { START_RATING, rateMatch } from "./rating";

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

// ---------- Match tables ----------
// Public: one row per running or finished match, keyed by room.
// phase: "play" | "call" | "reveal" | "over"
const match = table(
  { name: "match", public: true },
  {
    roomId: t.u64().primaryKey(),
    round: t.u32(),
    phase: t.string(),
    promptId: t.string(),
    roundStartedAt: t.timestamp(),
    phaseEndsAt: t.timestamp(),
    answer: t.string(),
    usedPrompts: t.string(),
  },
);

// Public per-player match state. The card fields stay empty until the call
// phase, so nobody sees another player's card while they are still choosing.
const match_seat = table(
  { name: "match_seat", public: true },
  {
    seatId: t.u64().primaryKey(),
    roomId: t.u64().index("btree"),
    identity: t.identity(),
    played: t.bool(),
    locked: t.bool(),
    cardGlyph: t.string(),
    cardEncoding: t.string(),
    cardValue: t.u32(),
    cardName: t.string(),
    cardRarity: t.string(),
    wasCorrect: t.bool(),
    lastResult: t.string(),
    score: t.u32(),
    streak: t.u8(),
    correct: t.u32(),
    answered: t.u32(),
    outRound: t.u32(),
    place: t.u8(),
    ratingBefore: t.u32(),
    ratingAfter: t.u32(),
  },
);

// Private: each player's cards. Clients read their own through my_hand.
const hand = table(
  { name: "hand" },
  {
    id: t.u64().primaryKey().autoInc(),
    seatId: t.u64().index("btree"),
    roomId: t.u64().index("btree"),
    cardId: t.string(),
    encoding: t.string(),
    glyph: t.string(),
    value: t.u32(),
    name: t.string(),
    flavor: t.string(),
    rarity: t.string(),
  },
);

// Private: the card each player put down this round.
const play = table(
  { name: "play" },
  {
    seatId: t.u64().primaryKey(),
    roomId: t.u64().index("btree"),
    handId: t.u64(),
    playedAt: t.timestamp(),
  },
);

// Private: who called whom this round. Revealed in the log after resolving.
const call = table(
  { name: "call" },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64().index("btree"),
    callerSeatId: t.u64().index("btree"),
    targetSeatId: t.u64(),
  },
);

// Public round log.
const match_event = table(
  { name: "match_event", public: true },
  {
    id: t.u64().primaryKey().autoInc(),
    roomId: t.u64().index("btree"),
    round: t.u32(),
    tone: t.string(),
    text: t.string(),
  },
);

// Server timer: one row per pending phase deadline.
const match_tick = table(
  { name: "match_tick" },
  {
    scheduledId: t.u64().primaryKey().autoInc(),
    scheduledAt: t.scheduleAt(),
    roomId: t.u64(),
    round: t.u32(),
    phase: t.string(),
  },
);

const spacetimedb = schema({
  card, prompt, score, player, account, guest_link, room, seat,
  match, match_seat, hand, play, call, match_event, match_tick,
});
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
    if (r && r.phase === "finished") {
      ctx.db.seat.id.delete(s.id);
      if (seatsIn(ctx, r.id).length === 0) clearRoom(ctx, r.id);
      continue;
    }
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
  startMatch(ctx, here.room.id);
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

// ---------- Match ----------
const MAX_HEALTH = 3;
const CALL_BASE_MS = 10_000;
const CALL_PER_OPPONENT_MS = 4_000;
const CALL_MAX_MS = 30_000;
const REVEAL_MS = 7_000;

function later(ctx: Ctx, ms: number): Timestamp {
  return new Timestamp(ctx.timestamp.microsSinceUnixEpoch + BigInt(Math.round(ms)) * 1000n);
}

function log(ctx: Ctx, roomId: bigint, round: number, tone: string, text: string) {
  ctx.db.match_event.insert({ id: 0n, roomId, round, tone, text });
}

function nameOf(ctx: Ctx, identity: Identity): string {
  return ctx.db.player.identity.find(identity)?.name ?? "Player";
}

function schedule(ctx: Ctx, roomId: bigint, round: number, phase: string, at: Timestamp) {
  ctx.db.match_tick.insert({
    scheduledId: 0n,
    scheduledAt: ScheduleAt.time(at.microsSinceUnixEpoch),
    roomId,
    round,
    phase,
  });
}

function living(ctx: Ctx, roomId: bigint) {
  return seatsIn(ctx, roomId).filter((s) => !s.eliminated);
}

function cardOf(row: { cardId: string; encoding: string; glyph: string; value: number; name: string; flavor: string; rarity: string }): CardDef {
  return {
    id: row.cardId,
    encoding: row.encoding as CardDef["encoding"],
    glyph: row.glyph,
    value: row.value,
    name: row.name,
    flavor: row.flavor,
    rarity: row.rarity as CardDef["rarity"],
  };
}

function clearRound(ctx: Ctx, roomId: bigint) {
  for (const h of [...ctx.db.hand.roomId.filter(roomId)]) ctx.db.hand.id.delete(h.id);
  for (const p of [...ctx.db.play.roomId.filter(roomId)]) ctx.db.play.seatId.delete(p.seatId);
  for (const c of [...ctx.db.call.roomId.filter(roomId)]) ctx.db.call.id.delete(c.id);
}

function clearRoom(ctx: Ctx, roomId: bigint) {
  clearRound(ctx, roomId);
  for (const m of [...ctx.db.match_seat.roomId.filter(roomId)]) ctx.db.match_seat.seatId.delete(m.seatId);
  for (const e of [...ctx.db.match_event.roomId.filter(roomId)]) ctx.db.match_event.id.delete(e.id);
  ctx.db.match.roomId.delete(roomId);
  ctx.db.room.id.delete(roomId);
}

function startMatch(ctx: Ctx, roomId: bigint) {
  const r = ctx.db.room.id.find(roomId)!;
  ctx.db.room.id.update({ ...r, phase: "playing" });
  for (const s of seatsIn(ctx, roomId)) {
    ctx.db.seat.id.update({ ...s, health: MAX_HEALTH, eliminated: false });
    ctx.db.match_seat.insert({
      seatId: s.id, roomId, identity: s.identity, played: false, locked: false,
      cardGlyph: "", cardEncoding: "", cardValue: 0, cardName: "", cardRarity: "",
      wasCorrect: false, lastResult: "", score: 0, streak: 0, correct: 0, answered: 0,
      outRound: 0, place: 0, ratingBefore: 0, ratingAfter: 0,
    });
  }
  ctx.db.match.insert({
    roomId, round: 0, phase: "starting", promptId: "", roundStartedAt: ctx.timestamp,
    phaseEndsAt: ctx.timestamp, answer: "", usedPrompts: "",
  });
  beginRound(ctx, roomId);
}

function beginRound(ctx: Ctx, roomId: bigint) {
  const m = ctx.db.match.roomId.find(roomId)!;
  const round = m.round + 1;
  const used = m.usedPrompts ? m.usedPrompts.split(",") : [];
  const prompt = pickPrompt(ctx.random, used);
  clearRound(ctx, roomId);
  const taken = new Set<string>();
  const alive = living(ctx, roomId);
  for (const s of alive) {
    for (const c of dealHand(ctx.random, prompt, taken)) {
      ctx.db.hand.insert({
        id: 0n, seatId: s.id, roomId, cardId: c.id, encoding: c.encoding, glyph: c.glyph,
        value: c.value, name: c.name, flavor: c.flavor, rarity: c.rarity,
      });
    }
  }
  for (const ms of [...ctx.db.match_seat.roomId.filter(roomId)]) {
    ctx.db.match_seat.seatId.update({
      ...ms, played: false, locked: false, cardGlyph: "", cardEncoding: "", cardValue: 0,
      cardName: "", cardRarity: "", wasCorrect: false, lastResult: "",
    });
  }
  const ends = later(ctx, roundTimerMs(round, prompt.difficulty));
  ctx.db.match.roomId.update({
    ...m, round, phase: "play", promptId: prompt.id, roundStartedAt: ctx.timestamp,
    phaseEndsAt: ends, answer: "", usedPrompts: [...used, prompt.id].join(","),
  });
  log(ctx, roomId, round, "neutral", `Round ${round}. ${alive.length} still standing. ${prompt.difficulty.toUpperCase()} prompt.`);
  schedule(ctx, roomId, round, "play", ends);
}

// Play phase over: auto-play for anyone out of time, reveal every card.
function enterCall(ctx: Ctx, roomId: bigint) {
  const m = ctx.db.match.roomId.find(roomId)!;
  const alive = living(ctx, roomId);
  for (const s of alive) {
    let p = ctx.db.play.seatId.find(s.id);
    if (!p) {
      const first = [...ctx.db.hand.seatId.filter(s.id)].sort((a, b) => Number(a.id - b.id))[0];
      if (!first) continue;
      p = ctx.db.play.insert({ seatId: s.id, roomId, handId: first.id, playedAt: ctx.timestamp });
      log(ctx, roomId, m.round, "warn", `${nameOf(ctx, s.identity)} ran out of time, so a card was played for them.`);
    }
    const h = ctx.db.hand.id.find(p.handId)!;
    const ms = ctx.db.match_seat.seatId.find(s.id)!;
    ctx.db.match_seat.seatId.update({
      ...ms, played: true, cardGlyph: h.glyph, cardEncoding: h.encoding, cardValue: h.value,
      cardName: h.name, cardRarity: h.rarity,
    });
  }
  const callMs = Math.min(CALL_MAX_MS, CALL_BASE_MS + CALL_PER_OPPONENT_MS * Math.max(0, alive.length - 1));
  const ends = later(ctx, callMs);
  ctx.db.match.roomId.update({ ...m, phase: "call", phaseEndsAt: ends });
  log(ctx, roomId, m.round, "warn", "Cards are face up. Call every card you think is wrong, then lock in.");
  schedule(ctx, roomId, m.round, "call", ends);
}

function resolveRound(ctx: Ctx, roomId: bigint) {
  const m = ctx.db.match.roomId.find(roomId)!;
  const prompt = promptById(m.promptId)!;
  const round = m.round;
  const alive = living(ctx, roomId);
  const health = new Map(alive.map((s) => [s.id, s.health]));
  const notes = new Map<bigint, string[]>(alive.map((s) => [s.id, []]));
  const correctOf = new Map<bigint, boolean>();
  const glyphOf = new Map<bigint, string>();
  const name = new Map(alive.map((s) => [s.id, nameOf(ctx, s.identity)]));
  const stats = new Map(alive.map((s) => [s.id, { ...ctx.db.match_seat.seatId.find(s.id)! }]));
  const bump = (id: bigint, d: number) =>
    health.set(id, Math.max(0, Math.min(MAX_HEALTH, (health.get(id) ?? 0) + d)));

  // 1. Score each card. Correct answers earn points; faster is worth more.
  for (const s of alive) {
    const p = ctx.db.play.seatId.find(s.id);
    const h = p ? ctx.db.hand.id.find(p.handId) : undefined;
    const ok = Boolean(h && isCorrect(cardOf(h), prompt));
    correctOf.set(s.id, ok);
    glyphOf.set(s.id, h?.glyph ?? "nothing");
    const st = stats.get(s.id)!;
    st.answered += 1;
    if (ok && p) {
      const elapsedMs = Number((p.playedAt.microsSinceUnixEpoch - m.roundStartedAt.microsSinceUnixEpoch) / 1000n);
      const pts = roundScore(prompt.difficulty, elapsedMs, true);
      st.correct += 1;
      st.score += pts;
      notes.get(s.id)!.push(`correct +${pts} pts`);
    } else {
      notes.get(s.id)!.push("wrong card");
    }
  }

  // 2. Calls, in the order they were made.
  const calls = [...ctx.db.call.roomId.filter(roomId)].sort((a, b) => Number(a.id - b.id));
  const caught = new Set<bigint>();
  const calledBy = new Map<bigint, Set<bigint>>();
  for (const c of calls) {
    if (!health.has(c.callerSeatId) || !health.has(c.targetSeatId)) continue;
    if (!calledBy.has(c.targetSeatId)) calledBy.set(c.targetSeatId, new Set());
    calledBy.get(c.targetSeatId)!.add(c.callerSeatId);
    const st = stats.get(c.callerSeatId)!;
    const who = name.get(c.callerSeatId)!;
    const target = name.get(c.targetSeatId)!;
    if (correctOf.get(c.targetSeatId)) {
      bump(c.callerSeatId, -1);
      st.streak = 0;
      notes.get(c.callerSeatId)!.push(`false call on ${target} -1 life`);
      log(ctx, roomId, round, "bad", `${who} called ${target}, but ${glyphOf.get(c.targetSeatId)} was right. ${who} loses 1 life.`);
      continue;
    }
    caught.add(c.targetSeatId);
    st.streak += 1;
    notes.get(c.callerSeatId)!.push(`caught ${target}`);
    if (st.streak >= 2) {
      st.streak = 0;
      if ((health.get(c.callerSeatId) ?? 0) < MAX_HEALTH) {
        bump(c.callerSeatId, 1);
        notes.get(c.callerSeatId)!.push("two calls in a row +1 life");
        log(ctx, roomId, round, "good", `${who} made two correct calls in a row and recovers 1 life.`);
      }
    }
  }

  // 3. Caught cards cost their owner 1 life, however many people called them.
  for (const id of caught) {
    bump(id, -1);
    notes.get(id)!.push("caught -1 life");
    const callers = [...(calledBy.get(id) ?? [])].map((c) => name.get(c)).join(", ");
    log(ctx, roomId, round, "good", `${name.get(id)}'s ${glyphOf.get(id)} was wrong. Called by ${callers}. ${name.get(id)} loses 1 life.`);
  }

  // 4. A wrong card nobody called costs every opponent 1 life (at most 1 per round).
  const missed = new Set<bigint>();
  for (const s of alive) {
    if (correctOf.get(s.id) || caught.has(s.id)) continue;
    const others = alive.filter((o) => o.id !== s.id);
    for (const o of others) missed.add(o.id);
    log(ctx, roomId, round, "warn", `Nobody called ${name.get(s.id)}'s wrong ${glyphOf.get(s.id)}. Everyone who missed it loses 1 life.`);
  }
  for (const id of missed) {
    bump(id, -1);
    stats.get(id)!.streak = 0;
    notes.get(id)!.push("missed a wrong card -1 life");
  }

  // 5. Apply results.
  log(ctx, roomId, round, "neutral", `The answer was ${prompt.answer}.`);
  for (const s of alive) {
    const hp = health.get(s.id)!;
    const out = hp <= 0;
    ctx.db.seat.id.update({ ...s, health: hp, eliminated: out });
    const st = stats.get(s.id)!;
    ctx.db.match_seat.seatId.update({
      ...st, wasCorrect: correctOf.get(s.id) ?? false, lastResult: notes.get(s.id)!.join(" · "),
      outRound: out ? round : st.outRound,
    });
    if (out) log(ctx, roomId, round, "bad", `${name.get(s.id)} is out of lives.`);
  }

  const still = living(ctx, roomId);
  if (still.length <= 1) {
    finishMatch(ctx, roomId, prompt.answer);
    return;
  }
  const ends = later(ctx, REVEAL_MS);
  ctx.db.match.roomId.update({ ...m, phase: "reveal", phaseEndsAt: ends, answer: prompt.answer });
  schedule(ctx, roomId, round, "reveal", ends);
}

function finishMatch(ctx: Ctx, roomId: bigint, answer: string) {
  const m = ctx.db.match.roomId.find(roomId)!;
  const rows = [...ctx.db.match_seat.roomId.filter(roomId)];
  // Still standing beats knocked out; later knockouts beat earlier; then score.
  const key = (r: (typeof rows)[number]) => [r.outRound === 0 ? Number.MAX_SAFE_INTEGER : r.outRound, r.score];
  const better = (a: (typeof rows)[number], b: (typeof rows)[number]) => {
    const [ao, as] = key(a);
    const [bo, bs] = key(b);
    return ao! > bo! || (ao === bo && as! > bs!);
  };
  const placeOf = new Map(rows.map((r) => [r.seatId, 1 + rows.filter((o) => better(o, r)).length]));
  const players = new Map(rows.map((r) => [r.seatId, ctx.db.player.identity.find(r.identity)]));
  const rated = rateMatch(
    rows.filter((r) => players.get(r.seatId)).map((r) => ({
      key: r.seatId.toString(),
      rating: players.get(r.seatId)!.rating,
      place: placeOf.get(r.seatId)!,
    })),
  );
  for (const r of rows) {
    const pl = players.get(r.seatId);
    const place = placeOf.get(r.seatId)!;
    const after = rated.get(r.seatId.toString()) ?? pl?.rating ?? 0;
    ctx.db.match_seat.seatId.update({ ...r, place, ratingBefore: pl?.rating ?? 0, ratingAfter: after });
    if (pl) {
      ctx.db.player.identity.update({
        ...pl,
        rating: after,
        matches: pl.matches + 1,
        wins: pl.wins + (place === 1 ? 1 : 0),
        correctAnswers: pl.correctAnswers + r.correct,
        totalAnswers: pl.totalAnswers + r.answered,
      });
    }
  }
  const winners = rows.filter((r) => placeOf.get(r.seatId) === 1).map((r) => nameOf(ctx, r.identity));
  log(ctx, roomId, m.round, "good", `${winners.join(" and ")} ${winners.length > 1 ? "share" : "takes"} the table.`);
  ctx.db.match.roomId.update({ ...m, phase: "over", answer, phaseEndsAt: ctx.timestamp });
  const r = ctx.db.room.id.find(roomId);
  if (r) ctx.db.room.id.update({ ...r, phase: "finished" });
}

// Moves the round on as soon as everyone has acted, instead of waiting for the clock.
function advanceIfReady(ctx: Ctx, roomId: bigint) {
  const m = ctx.db.match.roomId.find(roomId);
  if (!m) return;
  const alive = living(ctx, roomId);
  if (alive.length <= 1) {
    finishMatch(ctx, roomId, m.answer);
    return;
  }
  const states = alive.map((s) => ctx.db.match_seat.seatId.find(s.id)!);
  if (m.phase === "play" && alive.every((s) => ctx.db.play.seatId.find(s.id))) enterCall(ctx, roomId);
  else if (m.phase === "call" && states.every((x) => x.locked)) resolveRound(ctx, roomId);
}

function myMatchSeat(ctx: Ctx) {
  for (const s of ctx.db.seat.identity.filter(ctx.sender)) {
    const r = ctx.db.room.id.find(s.roomId);
    const m = ctx.db.match.roomId.find(s.roomId);
    if (r && r.phase === "playing" && m) return { seat: s, match: m };
  }
  throw new SenderError("You are not in a running match");
}

// Fires when a phase's clock runs out. Stale ticks (the phase already moved on) do nothing.
export const match_timer = spacetimedb.reducer({ onSchedule: match_tick }, { tick: match_tick.rowType }, (ctx, { tick }) => {
  if (!ctx.sender.isEqual(ctx.databaseIdentity)) throw new SenderError("Server timer only");
  const m = ctx.db.match.roomId.find(tick.roomId);
  if (!m || m.round !== tick.round || m.phase !== tick.phase) return;
  if (m.phase === "play") enterCall(ctx, tick.roomId);
  else if (m.phase === "call") resolveRound(ctx, tick.roomId);
  else if (m.phase === "reveal") beginRound(ctx, tick.roomId);
});

export const play_card = spacetimedb.reducer({ handId: t.u64() }, (ctx, { handId }) => {
  const { seat, match: m } = myMatchSeat(ctx);
  if (m.phase !== "play") throw new SenderError("Not the time to play a card");
  if (seat.eliminated) throw new SenderError("You are out of this match");
  if (ctx.db.play.seatId.find(seat.id)) throw new SenderError("You already played this round");
  const h = ctx.db.hand.id.find(handId);
  if (!h || h.seatId !== seat.id) throw new SenderError("That card is not in your hand");
  ctx.db.play.insert({ seatId: seat.id, roomId: seat.roomId, handId, playedAt: ctx.timestamp });
  const ms = ctx.db.match_seat.seatId.find(seat.id)!;
  ctx.db.match_seat.seatId.update({ ...ms, played: true });
  advanceIfReady(ctx, seat.roomId);
});

export const toggle_call = spacetimedb.reducer({ targetSeatId: t.u64() }, (ctx, { targetSeatId }) => {
  const { seat, match: m } = myMatchSeat(ctx);
  if (m.phase !== "call") throw new SenderError("Calls open once every card is face up");
  if (seat.eliminated) throw new SenderError("You are out of this match");
  if (ctx.db.match_seat.seatId.find(seat.id)?.locked) throw new SenderError("Your calls are locked in");
  const target = ctx.db.seat.id.find(targetSeatId);
  if (!target || target.roomId !== seat.roomId || target.eliminated) throw new SenderError("No such player");
  if (target.id === seat.id) throw new SenderError("You cannot call yourself");
  const existing = [...ctx.db.call.callerSeatId.filter(seat.id)].find((c) => c.targetSeatId === targetSeatId);
  if (existing) ctx.db.call.id.delete(existing.id);
  else ctx.db.call.insert({ id: 0n, roomId: seat.roomId, callerSeatId: seat.id, targetSeatId });
});

export const lock_calls = spacetimedb.reducer((ctx) => {
  const { seat, match: m } = myMatchSeat(ctx);
  if (m.phase !== "call" || seat.eliminated) return;
  const ms = ctx.db.match_seat.seatId.find(seat.id)!;
  ctx.db.match_seat.seatId.update({ ...ms, locked: true });
  advanceIfReady(ctx, seat.roomId);
});

// Give up mid-match: you place by when you left, and the table carries on.
export const forfeit = spacetimedb.reducer((ctx) => {
  const { seat, match: m } = myMatchSeat(ctx);
  if (seat.eliminated) return;
  ctx.db.seat.id.update({ ...seat, health: 0, eliminated: true });
  const ms = ctx.db.match_seat.seatId.find(seat.id)!;
  ctx.db.match_seat.seatId.update({ ...ms, outRound: Math.max(1, m.round), lastResult: "forfeited" });
  log(ctx, seat.roomId, m.round, "bad", `${nameOf(ctx, seat.identity)} forfeits.`);
  advanceIfReady(ctx, seat.roomId);
});

// Each player's own cards, play, and calls; nobody else can read them.
export const my_hand = spacetimedb.view({ name: "my_hand", public: true }, t.array(hand.rowType), (ctx) => {
  const out = [];
  for (const s of ctx.db.seat.identity.filter(ctx.sender)) out.push(...ctx.db.hand.seatId.filter(s.id));
  return out;
});

export const my_play = spacetimedb.view({ name: "my_play", public: true }, t.array(play.rowType), (ctx) => {
  const out = [];
  for (const s of ctx.db.seat.identity.filter(ctx.sender)) {
    const p = ctx.db.play.seatId.find(s.id);
    if (p) out.push(p);
  }
  return out;
});

export const my_calls = spacetimedb.view({ name: "my_calls", public: true }, t.array(call.rowType), (ctx) => {
  const out = [];
  for (const s of ctx.db.seat.identity.filter(ctx.sender)) out.push(...ctx.db.call.callerSeatId.filter(s.id));
  return out;
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