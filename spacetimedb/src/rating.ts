// Multiplayer Elo: every pair of players at the table is treated as a
// head-to-head result decided by finishing place (1 = winner). K is split
// across opponents so a 6-player table moves ratings about as much as a duel.

export const START_RATING = 1000;
const K = 32;
const FLOOR = 100;

export type Placement = { key: string; rating: number; place: number };

function expected(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

export function rateMatch(players: Placement[]): Map<string, number> {
  const out = new Map<string, number>();
  const n = players.length;
  if (n < 2) {
    for (const p of players) out.set(p.key, p.rating);
    return out;
  }
  const k = K / (n - 1);
  for (const a of players) {
    let delta = 0;
    for (const b of players) {
      if (a === b) continue;
      const score = a.place < b.place ? 1 : a.place > b.place ? 0 : 0.5;
      delta += k * (score - expected(a.rating, b.rating));
    }
    out.set(a.key, Math.max(FLOOR, Math.round(a.rating + delta)));
  }
  return out;
}
