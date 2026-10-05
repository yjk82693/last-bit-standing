import { schema, t, table, SenderError, type InferSchema, type ReducerCtx } from "spacetimedb/server";
import { CARDS, PROMPTS } from "../../src/lib/catalog";

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

// One row per connected identity.
const player = table(
  { name: "player", public: true },
  {
    identity: t.identity().primaryKey(),
    name: t.string(),
    online: t.bool(),
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

const spacetimedb = schema({ card, prompt, score, player, room, seat });
export default spacetimedb;

const QUICK_SIZES = [2, 3, 4];
const CUSTOM_MIN = 2;
const CUSTOM_MAX = 6;
const START_HEALTH = 3;
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

type Ctx = ReducerCtx<InferSchema<typeof spacetimedb>>;

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
  const existing = ctx.db.player.identity.find(ctx.sender);
  if (existing) {
    ctx.db.player.identity.update({ ...existing, online: true });
  } else {
    ctx.db.player.insert({ identity: ctx.sender, name: "Player", online: true });
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