// Solo (bot table) rule switches approved by the Chairman on 2026-11-08
// (R1-R3). Only the solo engine (engine.ts) reads these. Multiplayer runs on
// the SpacetimeDB module (spacetimedb/src), which imports only the card
// judging helpers from engine.ts and never reads this file.
export const SOLO_RULES = {
  // R1: bot cards stay face down, and the log does not name them, until the
  // player has played (by hand or by the timeout auto-play).
  hideBotCardsUntilPlay: true,
  // R2: calls the player may hold per round. A call on a right bot counts too.
  callsPerRound: 2,
  // R3: from startRound on, each living bot's accuracy drops by perRound for
  // every round (round 6 = -0.05, round 7 = -0.10, ...), down to floor. A bot
  // that starts below floor keeps its own value.
  overheat: {
    startRound: 6,
    perRound: 0.05,
    floor: 0.3,
  },
} as const;

/** R3: how much accuracy overheat has taken off in this round (0 before it starts). */
export function overheatDrop(
  round: number,
  overheat: { startRound: number; perRound: number } = SOLO_RULES.overheat,
): number {
  if (round < overheat.startRound) return 0;
  return (round - overheat.startRound + 1) * overheat.perRound;
}

/** R3: a bot's base accuracy after overheat for this round. */
export function overheatedAccuracy(
  base: number,
  round: number,
  overheat: { startRound: number; perRound: number; floor: number } = SOLO_RULES.overheat,
): number {
  const drop = overheatDrop(round, overheat);
  if (drop <= 0) return base;
  const floor = Math.min(base, overheat.floor);
  // Round to 1e-9 so 0.9 - 0.15 does not read as 0.7500000000000001.
  return Math.round(Math.max(floor, base - drop) * 1e9) / 1e9;
}
