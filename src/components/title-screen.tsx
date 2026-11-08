"use client";

import { useMemo } from "react";
import { Binary, BookOpen, ShieldAlert, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MainMenuButton } from "@/components/main-menu-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EncodingCard } from "@/components/encoding-card";
import { CARDS } from "@/lib/catalog";
import { BOTS } from "@/lib/bots";
import type { ScoreRow } from "@/lib/types";
import { themeScope } from "@/lib/theme";

export function TitleScreen({
  playerName,
  storeLabel,
  scores,
  onStart,
  onResetScores,
}: {
  playerName: string;
  storeLabel: string;
  scores: ScoreRow[];
  onStart: () => void;
  onResetScores: () => void;
}) {
  const samples = useMemo(() => {
    const wanted = ["binary-50", "hex-8", "ascii-65", "binary-255"];
    return wanted
      .map((id) => CARDS.find((card) => card.id === id))
      .filter(Boolean);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:py-14">
      <header className="space-y-4 text-center sm:text-left">
        <p className="font-mono text-xs tracking-[0.28em] text-lbs-accent-2/80">
          HUMAN VS FIVE LANGUAGE MODELS
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-lbs-text-hi sm:text-6xl">
          Last Bit Standing
        </h1>
        <p className="max-w-2xl text-pretty text-base leading-7 text-lbs-text-dim sm:text-lg">
          Six players. Seven encoding cards. Each round a prompt hits the table
          and you answer with binary, hex, or ASCII. Bot cards stay face down
          until you play. Then call up to two wrong bots to take a life each.
          Two correct calls in a row restore one of yours. Play the wrong card,
          or call a right bot, and you lose one. From round 6 the bots
          overheat and slip. You win with at least one life after every bot is
          out.
        </p>
      </header>

      <div className="flex flex-wrap justify-center gap-3 sm:justify-start">
        {samples.map((card) =>
          card ? (
            <EncodingCard key={card.id} card={card} />
          ) : null,
        )}
      </div>

      <section className="grid gap-4 rounded-2xl border border-lbs-line bg-lbs-well-light p-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="grid gap-1">
          <span className="text-sm text-lbs-text-2">Playing as</span>
          <span className="text-lg font-medium text-lbs-text">{playerName}</span>
          <span className="text-xs text-lbs-text-3">Change your name from your profile on the main menu.</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={onStart}>
            Sit at the table
          </Button>
          <HowToPlay />
          <MainMenuButton size="lg" />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {BOTS.map((bot) => (
          <article
            key={bot.id}
            className="rounded-xl border border-lbs-line bg-lbs-well-faint p-4"
          >
            <div className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ background: bot.accent }}
              />
              <h2 className="font-medium text-lbs-text">{bot.name}</h2>
              <span className="text-xs text-lbs-text-3">{bot.title}</span>
            </div>
            <p className="mt-2 text-sm text-lbs-text-2">{bot.blurb}</p>
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-lbs-line bg-lbs-well-faint p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-lbs-text-dim">
            <Trophy className="size-4 text-lbs-accent" />
            Leaderboard
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={scores.length === 0}
            onClick={() => {
              if (scores.length === 0) return;
              if (!window.confirm("Clear every row on this leaderboard?")) return;
              onResetScores();
            }}
          >
            Reset board
          </Button>
        </div>
        {scores.length === 0 ? (
          <p className="text-sm text-lbs-text-3">
            No scores yet. A win ranks above every fall, then higher points take
            the top.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-fixed border-collapse font-mono text-xs">
              <colgroup>
                <col className="w-10" />
                <col className="w-36" />
                <col className="w-14" />
                <col className="w-14" />
                <col className="w-16" />
                <col className="w-14" />
              </colgroup>
              <thead>
                <tr className="text-[10px] tracking-wide text-lbs-text-4">
                  <th className="py-1 pr-2 text-left font-medium">#</th>
                  <th className="py-1 pr-3 text-left font-medium">Name</th>
                  <th className="py-1 pr-3 text-left font-medium">Result</th>
                  <th className="py-1 pr-3 text-right font-medium">Pts</th>
                  <th className="py-1 pr-3 text-right font-medium">Round</th>
                  <th className="py-1 text-right font-medium">Calls</th>
                </tr>
              </thead>
              <tbody className="text-lbs-text-2">
                {scores.slice(0, 10).map((row, index) => (
                  <tr key={row.id}>
                    <td className="py-1 pr-2 tabular-nums text-lbs-text-3">
                      {index + 1}
                    </td>
                    <td
                      className="truncate py-1 pr-3 text-lbs-text-soft"
                      title={row.name}
                    >
                      {row.name}
                    </td>
                    <td
                      className={`py-1 pr-3 ${
                        row.won ? "text-success" : "text-lbs-bad-2"
                      }`}
                    >
                      {row.won ? "won" : "fell"}
                    </td>
                    <td className="py-1 pr-3 text-right tabular-nums">
                      {row.score ?? 0}
                    </td>
                    <td className="py-1 pr-3 text-right tabular-nums">
                      {row.rounds}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {row.correctCalls}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 font-mono text-[11px] text-lbs-text-4">
          Wins sit above falls. Then points, remaining lives, and rounds.
          Card store: {storeLabel}
        </p>
      </section>
    </div>
  );
}

function HowToPlay() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="lg" variant="outline">
          How to play
        </Button>
      </DialogTrigger>
      <DialogContent {...themeScope} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Rules of the table</DialogTitle>
          <DialogDescription>
            Decode the prompt. Play a card. Accuse the models that are making it
            up.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid gap-3 text-sm text-lbs-text-dim">
          <li className="flex gap-2">
            <Binary className="mt-0.5 size-4 shrink-0 text-lbs-accent" />
            Each living player is dealt 7 cards. Yours always include the bank
            answer plus six distractors, then shuffled. The glyph on top is
            binary, hex, or ASCII. Easy rounds print a direct translation on
            the card foot. Medium keeps the flavor line. Hard hides it.
          </li>
          <li className="flex gap-2">
            <BookOpen className="mt-0.5 size-4 shrink-0 text-lbs-accent" />
            Play the card that answers the prompt. Easy = 5, medium = 10, hard =
            15. The timer is still on the felt: ≤15s ×2, ≤30s ×1.5, ≤60s ×1.25,
            slower ×1. Hard prompts get a longer clock. A wrong card shows the
            matching card from your hand on the right, with a one-line why
            underneath. Three lamps for the whole table — they do not refill.
            Extra lamps on the same question get more direct; the third is the
            answer. You still pick any card. The clock pauses while a hint is
            open.
          </li>
          <li className="flex gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-lbs-accent" />
            Bot cards stay face down until you play (if the clock runs out,
            your selected card, or the leftmost one, is played for you). Then
            the cards turn over and you get two calls per round: tap a bot
            whose answer is wrong and it loses 1 of 3 lives. A call on a right
            bot also uses a call. Two correct calls in a row restore 1 of your
            lives, up to 3. Tap a bot who was right, or play the wrong card yourself, and
            you lose a life. Lives carry into the next round. A bot at 0 stays
            on the felt, darkened, with their last play showing.
          </li>
          <li>
            Everyone starts with 3 lives. You win if you still have at least 1
            life and every bot has lost all 3. From round 6 the bots overheat:
            each round their accuracy drops by 0.05, down to 0.3. A card played
            when the clock runs out is judged like any play.
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  );
}
