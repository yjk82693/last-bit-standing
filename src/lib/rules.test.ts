import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOTS } from "./bots";
import { CARDS, PROMPTS } from "./catalog";
import {
  answerCardFor,
  beginRound,
  botCardsHidden,
  callsLeft,
  chooseBotCard,
  createMatch,
  playBot,
  playHuman,
  timeoutHuman,
  toggleAccuse,
  isExactCard,
  matchQuality,
} from "./engine";
import { overheatDrop, overheatedAccuracy, SOLO_RULES } from "./rules";

// ---- R3: overheat from round 6, -0.05 per round, floor 0.3 ----
assert.equal(SOLO_RULES.overheat.startRound, 6);
assert.equal(SOLO_RULES.overheat.perRound, 0.05);
assert.equal(SOLO_RULES.overheat.floor, 0.3);
assert.equal(overheatDrop(1), 0);
assert.equal(overheatDrop(5), 0);
assert.equal(overheatedAccuracy(0.9, 5), 0.9);
assert.equal(overheatedAccuracy(0.9, 6), 0.85);
assert.equal(overheatedAccuracy(0.9, 7), 0.8);
assert.equal(overheatedAccuracy(0.9, 17), 0.3); // 0.9 - 0.60 = 0.30
assert.equal(overheatedAccuracy(0.9, 30), 0.3); // floor
assert.equal(overheatedAccuracy(0.34, 6), 0.3); // 0.29 would pass the floor
assert.equal(overheatedAccuracy(0.25, 6), 0.25); // starts below floor: unchanged
assert.equal(overheatedAccuracy(0.25, 40), 0.25);

// chooseBotCard uses the overheated value: with Math.random fixed between
// the round-5 and round-12 accuracy, NullPtr (0.9) plays the exact card in
// round 5 and misses in round 12 (0.9 - 0.35 = 0.55).
const nullptr = BOTS.find((bot) => bot.id === "nullptr")!;
const prompt = PROMPTS.find((item) => item.category !== nullptr.specialty)!;
// Fixed hand: the exact card first, then six plain misses (no "close"), so
// the result does not depend on a random deal.
const misses = CARDS.filter((card) => matchQuality(card, prompt) === "miss").slice(0, 6);
assert.equal(misses.length, 6);
const hand = [answerCardFor(prompt), ...misses];
assert.ok(isExactCard(hand[0]!, prompt));
const realRandom = Math.random;
Math.random = () => 0.7;
try {
  assert.ok(isExactCard(chooseBotCard(nullptr, hand, prompt, 1, 5), prompt));
  assert.ok(!isExactCard(chooseBotCard(nullptr, hand, prompt, 1, 12), prompt));
  // No round = base accuracy (the pre-R3 call shape).
  assert.ok(isExactCard(chooseBotCard(nullptr, hand, prompt, 1), prompt));
} finally {
  Math.random = realRandom;
}

// Multiplayer is untouched: the SpacetimeDB module does not use the bot
// chooser or the solo rules.
const server = readFileSync(
  new URL("../../spacetimedb/src/index.ts", import.meta.url),
  "utf8",
) + readFileSync(new URL("../../spacetimedb/src/cards.ts", import.meta.url), "utf8");
assert.ok(!server.includes("chooseBotCard"));
assert.ok(!server.includes("SOLO_RULES"));
assert.ok(!server.includes("overheat"));

// ---- R1: bot cards face down until the player plays ----
assert.equal(SOLO_RULES.hideBotCardsUntilPlay, true);
{
  const start = beginRound(createMatch("Hidden", "local"), 1_000_000);
  assert.equal(botCardsHidden(start), true);
  const botPlayed = playBot(start, "hexa", 1_000_000);
  const hexa = botPlayed.players.find((player) => player.id === "hexa")!;
  assert.ok(hexa.played, "the bot did play");
  assert.equal(botCardsHidden(botPlayed), true);
  const lastLog = botPlayed.logs.at(-1)!.text;
  assert.ok(lastLog.includes("face down"), lastLog);
  assert.ok(!lastLog.includes(hexa.played!.glyph), "log must not name the card");
  // The player plays: everything turns face up, later bot plays are named.
  const you = botPlayed.players.find((player) => player.isHuman)!;
  const afterYou = playHuman(botPlayed, you.hand[0]!.id);
  assert.equal(botCardsHidden(afterYou), false);
  const later = playBot(afterYou, "clippy", 1_000_000);
  const clippy = later.players.find((player) => player.id === "clippy")!;
  assert.ok(later.logs.at(-1)!.text.includes(clippy.played!.glyph));
  // Timeout auto-play reveals the same way.
  const timedOut = timeoutHuman(botPlayed);
  assert.equal(botCardsHidden(timedOut), false);
}

// ---- R2: two calls per round ----
assert.equal(SOLO_RULES.callsPerRound, 2);
function accusingTable() {
  let state = beginRound(createMatch("Calls", "local"), 1_000_000);
  const you = state.players.find((player) => player.isHuman)!;
  state = playHuman(state, you.hand[0]!.id);
  for (const bot of BOTS) state = playBot(state, bot.id, 1_000_000);
  assert.equal(state.phase, "accusing");
  return state;
}
const table = accusingTable();
assert.equal(callsLeft(table), 2);
const one = toggleAccuse(table, "clippy");
const two = toggleAccuse(one, "hexa");
assert.deepEqual(two.accusedIds, ["clippy", "hexa"]);
assert.equal(callsLeft(two), 0);
const third = toggleAccuse(two, "bitwise");
assert.equal(third, two, "a third call is refused");
assert.deepEqual(third.accusedIds, ["clippy", "hexa"]);
// Taking a call back frees it.
const undo = toggleAccuse(two, "hexa");
assert.deepEqual(undo.accusedIds, ["clippy"]);
assert.equal(callsLeft(undo), 1);
assert.deepEqual(toggleAccuse(undo, "bitwise").accusedIds, ["clippy", "bitwise"]);

console.log("rules.test ok · R1 hidden cards, R2 calls, R3 overheat");
