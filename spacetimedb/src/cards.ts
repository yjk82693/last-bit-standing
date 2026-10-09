// Server-side dealing for multiplayer. Card checks reuse the solo engine so
// both modes judge answers identically; randomness comes from ctx.random.
import { CARDS, PROMPTS } from "../../src/lib/catalog";
import { HAND_SIZE } from "../../src/lib/bots";
import { answerCardFor, cardShowsAnswer, isExactCard, matchQuality } from "../../src/lib/engine";
import type { CardDef, PromptDef } from "../../src/lib/types";

export type Rand = () => number;

function shuffle<T>(rand: Rand, items: readonly T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

export function isCorrect(card: CardDef, prompt: PromptDef): boolean {
  return isExactCard(card, prompt) || cardShowsAnswer(card, prompt);
}

export function promptById(id: string): PromptDef | undefined {
  return PROMPTS.find((p) => p.id === id);
}

// Picks a prompt not used yet this match (starts over once all are used).
export function pickPrompt(rand: Rand, used: readonly string[]): PromptDef {
  const fresh = PROMPTS.filter((p) => !used.includes(p.id));
  const pool = fresh.length > 0 ? fresh : PROMPTS;
  return pool[Math.floor(rand() * pool.length)]!;
}

function isDistractor(card: CardDef, prompt: PromptDef): boolean {
  return !isCorrect(card, prompt);
}

// One player's 7 cards: exactly one that answers the prompt, the rest wrong,
// preferring near misses so the call phase has something to catch.
// `used` keeps card ids unique across the whole table.
export function dealHand(rand: Rand, prompt: PromptDef, used: Set<string>): CardDef[] {
  const answer = answerCardFor(prompt);
  const showing = CARDS.filter((c) => !used.has(c.id) && cardShowsAnswer(c, prompt));
  const preferred = showing.filter((c) => c.encoding === answer.encoding);
  let correct = shuffle(rand, preferred.length > 0 ? preferred : showing)[0];
  if (!correct) {
    // Every printed answer card is taken: mint one for this seat.
    correct = { ...answer, id: `${answer.id}-${used.size}` };
  }
  used.add(correct.id);

  const wrong: CardDef[] = [];
  for (const c of shuffle(rand, CARDS)) {
    if (wrong.length >= 3) break;
    if (used.has(c.id) || !isDistractor(c, prompt) || matchQuality(c, prompt) !== "close") continue;
    used.add(c.id);
    wrong.push(c);
  }
  for (const c of shuffle(rand, CARDS)) {
    if (wrong.length >= HAND_SIZE - 1) break;
    if (used.has(c.id) || !isDistractor(c, prompt)) continue;
    used.add(c.id);
    wrong.push(c);
  }
  let offset = 1;
  while (wrong.length < HAND_SIZE - 1 && offset < 200) {
    const value = (prompt.matchValues?.[0] ?? 1) + offset;
    offset += 1;
    const id = `near-${prompt.id}-${value}`;
    if (used.has(id)) continue;
    const card: CardDef = {
      id,
      encoding: answer.encoding,
      glyph:
        answer.encoding === "hex"
          ? `0x${value.toString(16).toUpperCase()}`
          : answer.encoding === "ascii" && value >= 32 && value <= 126
            ? String.fromCharCode(value)
            : value.toString(2).padStart(8, "0").replace(/(.{4})/g, "$1 ").trim(),
      value,
      name: `Near miss ${value}`,
      flavor: "Nearby, but not the answer.",
      rarity: "common",
    };
    if (!isDistractor(card, prompt)) continue;
    used.add(id);
    wrong.push(card);
  }
  return shuffle(rand, [correct, ...wrong]);
}
