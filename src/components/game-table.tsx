"use client";

import { Lightbulb, XIcon } from "lucide-react";
import { BOTS, HINTS_PER_SESSION, roundAccuseMs, roundTimerMs } from "@/lib/bots";
import { EncodingCard } from "@/components/encoding-card";
import { EncodingHelp } from "@/components/encoding-help";
import { HealthPips, PlayerSeat } from "@/components/player-seat";
import { Button } from "@/components/ui/button";
import { MainMenuButton } from "@/components/main-menu-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { displayedHint, matchQuality, youPlayer } from "@/lib/engine";
import { explainFromCard } from "@/lib/questions";
import { basePoints, multiplierLabel, speedMultiplier } from "@/lib/scoring";
import type { GameState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { themeScope } from "@/lib/theme";
import { overheatDrop, SOLO_RULES } from "@/lib/rules";

// End-screen summary of this run, built in GameApp from per-round state.
export type RunStats = {
  // Rounds resolved this run.
  answered: number;
  // Rounds where the player's card was right.
  correct: number;
  // Fastest right answer (ms from prompt to play), null if none was right.
  fastestMs: number | null;
};

// Warn this long before the clock ends that a card will be played for you.
const AUTO_PLAY_NOTICE_MS = 10_000;

export function GameTable({
  state,
  now,
  helpOpen,
  runStats,
  previousBest = null,
  onPlayAgain,
  onSelect,
  onPlay,
  onAccuse,
  onResolveNow,
  onNext,
  onQuit,
  onHint,
  onCloseHint,
  onOpenHelp,
  onCloseHelp,
}: {
  state: GameState;
  now: number;
  helpOpen: boolean;
  runStats?: RunStats;
  previousBest?: number | null;
  onPlayAgain?: () => void;
  onSelect: (cardId: string) => void;
  onPlay: () => void;
  onAccuse: (botId: string) => void;
  onResolveNow: () => void;
  onNext: () => void;
  onQuit: () => void;
  onHint: () => void;
  onCloseHint: () => void;
  onOpenHelp: () => void;
  onCloseHelp: () => void;
}) {
  const you = youPlayer(state);
  const byId = Object.fromEntries(state.players.map((player) => [player.id, player]));
  const difficulty = state.prompt?.difficulty ?? "medium";
  const total =
    state.phase === "accusing"
      ? roundAccuseMs(state.round)
      : roundTimerMs(state.round, difficulty);
  const remain =
    state.phase === "accusing"
      ? Math.max(0, state.accuseDeadlineAt - now)
      : Math.max(0, state.deadlineAt - now);
  const ratio = total > 0 ? Math.min(1, remain / total) : 0;
  const prompt = state.prompt;
  const canPlay = state.phase === "prompting" && !you.played && Boolean(state.selectedCardId);
  const canAccuse = state.phase === "accusing";
  const elapsed =
    you.played && state.answeredAt
      ? Math.max(0, state.answeredAt - state.promptStartedAt)
      : Math.max(0, now - (state.promptStartedAt || now));
  const liveMultiplier = multiplierLabel(elapsed);
  const liveSpeed = speedMultiplier(elapsed);
  const revealing = state.phase === "resolving" || state.phase === "gameover";
  const hintsLeft = state.hintsRemaining ?? 0;
  const hintLevel = state.hintLevel ?? 0;
  const canHint =
    (state.phase === "prompting" || state.phase === "accusing") &&
    ((hintsLeft > 0 && hintLevel < 3) || (hintLevel > 0 && !state.hintOpen));

  return (
    <div className="relative flex min-h-screen flex-col">
      {state.phase === "gameover" ? (
        <ArcadeBanner win={state.winnerId === "you"} />
      ) : null}

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-lbs-line px-4 py-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.24em] text-lbs-accent-2/70">
            LAST BIT STANDING
          </p>
          <p className="text-sm text-lbs-text-dim">
            Round {state.round}
            {state.phase === "accusing" ? " · call lives" : ""}
            {state.phase === "resolving" ? " · reveal" : ""}
          </p>
          {overheatDrop(state.round) > 0 ? (
            // R3: one small line once bots start to overheat.
            <p className="font-mono text-[11px] text-warning">
              Overheat −{SOLO_RULES.overheat.perRound.toFixed(2)}/round · bot accuracy −
              {overheatDrop(state.round).toFixed(2)}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3 sm:gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "gap-1.5 font-mono text-lbs-accent-2",
                  !canHint && "opacity-40",
                )}
                disabled={!canHint}
                onClick={onHint}
                aria-label={`Hint, ${hintsLeft} left this table`}
              >
                <Lightbulb
                  className={cn(
                    "size-4",
                    state.hintOpen
                      ? "fill-lbs-accent text-lbs-accent"
                      : "text-lbs-accent-2",
                  )}
                />
                <span className="text-[11px] tracking-[0.16em]">
                  {hintsLeft}/{HINTS_PER_SESSION}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent {...themeScope}>
              {hintsLeft <= 0 && hintLevel === 0
                ? "No lamps left this table."
                : hintLevel >= 3
                  ? "That was the answer. Lamps do not refill."
                  : hintLevel === 2
                    ? "Third lamp is the answer. Lamps do not refill."
                    : hintLevel === 1
                      ? "Second lamp is more direct. Third lamp is the answer."
                      : "Three lamps for the table. Each extra lamp on this question is more direct."}
            </TooltipContent>
          </Tooltip>
          <div className="font-mono text-sm text-lbs-accent-2">
            Score {state.score}
            {state.lastRoundPoints > 0 && state.phase !== "prompting"
              ? ` · +${state.lastRoundPoints}`
              : ""}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-lbs-text-2">Your lives</span>
            <HealthPips health={you.health} variant="bits" size="hud" />
          </div>
          <Button variant="ghost" size="sm" onClick={onQuit}>
            Leave table
          </Button>
          <MainMenuButton
            confirmMessage={
              state.phase === "gameover" ? undefined : "Leave this match for the main menu? This run will be lost."
            }
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "text-lbs-accent-2",
                  helpOpen && "bg-lbs-hover text-lbs-accent-3",
                )}
                aria-label="Encoding help"
                aria-expanded={helpOpen}
                onClick={onOpenHelp}
              >
                <span className="font-mono text-base font-semibold leading-none">
                  ?
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent {...themeScope}>Binary, hex, octal, and ASCII help</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <EncodingHelp
        open={helpOpen}
        heldSeconds={
          state.phase === "prompting" || state.phase === "accusing"
            ? Math.ceil(remain / 1000)
            : null
        }
        onClose={onCloseHelp}
      />

      {state.hintOpen && prompt ? (
        <div className="flex items-start gap-3 border-b border-lbs-accent-2/20 bg-lbs-accent-wash px-4 py-3 text-sm text-lbs-accent-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] tracking-[0.2em] text-lbs-accent-2/80">
              {hintLevel >= 3
                ? "ANSWER · CLOCK PAUSED"
                : hintLevel === 2
                  ? "DIRECT HINT · CLOCK PAUSED"
                  : "HINT · CLOCK PAUSED"}
            </p>
            <p className="mt-1 text-pretty leading-6">{displayedHint(state)}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="mt-0.5 shrink-0 text-lbs-accent-3 hover:bg-lbs-accent-2/10"
            aria-label="Close hint"
            onClick={onCloseHint}
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      ) : null}

      <div className="h-1 w-full bg-lbs-timer-track">
        <div
          className={cn(
            "h-full transition-[width] duration-100",
            ratio < 0.2 ? "bg-lbs-timer-low" : liveSpeed >= 2 ? "bg-lbs-timer-bonus" : "bg-lbs-timer",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>

      <div className="grid gap-4 px-3 py-4 lg:grid-cols-[1fr_220px] lg:px-6">
        <div className="rounded-[2rem] border border-lbs-rail bg-[radial-gradient(ellipse_at_center,_var(--lbs-felt)_0%,_var(--lbs-felt-mid)_55%,_var(--lbs-felt-edge)_100%)] p-3 shadow-inner sm:p-6">
          <div className="grid grid-cols-3 justify-items-center gap-2 overflow-x-auto sm:gap-3">
            <PlayerSeat
              player={byId.hexa}
              bot={BOTS.find((bot) => bot.id === "hexa")}
              accused={state.accusedIds.includes("hexa")}
              stamp={stampFor(state, "hexa")}
              missed={missedCall(state, "hexa")}
              canAccuse={canAccuse && !byId.hexa?.eliminated}
              difficulty={prompt?.difficulty}
              onAccuse={() => onAccuse("hexa")}
            />
            <PlayerSeat
              player={byId.clippy}
              bot={BOTS.find((bot) => bot.id === "clippy")}
              accused={state.accusedIds.includes("clippy")}
              stamp={stampFor(state, "clippy")}
              missed={missedCall(state, "clippy")}
              canAccuse={canAccuse && !byId.clippy?.eliminated}
              difficulty={prompt?.difficulty}
              onAccuse={() => onAccuse("clippy")}
            />
            <PlayerSeat
              player={byId.bitwise}
              bot={BOTS.find((bot) => bot.id === "bitwise")}
              accused={state.accusedIds.includes("bitwise")}
              stamp={stampFor(state, "bitwise")}
              missed={missedCall(state, "bitwise")}
              canAccuse={canAccuse && !byId.bitwise?.eliminated}
              difficulty={prompt?.difficulty}
              onAccuse={() => onAccuse("bitwise")}
            />
          </div>

          <div className="mx-auto my-4 max-w-xl rounded-2xl border border-lbs-accent-2/20 bg-lbs-well-mid p-4 text-center backdrop-blur-sm">
            <p className="font-mono text-[10px] tracking-[0.22em] text-lbs-accent-2/70">
              {state.phase === "dealing"
                ? "SHUFFLING"
                : prompt
                  ? `${(prompt.difficulty ?? "medium").toUpperCase()} · ${basePoints(prompt.difficulty ?? "medium")} PTS`
                  : "PROMPT"}
            </p>
            <p className="mt-2 text-pretty text-lg font-medium text-lbs-text-hi sm:text-2xl">
              {prompt?.text ?? "The dealer is cutting the deck…"}
            </p>
            {state.phase === "prompting" || state.phase === "accusing" ? (
              <p className="mt-2 font-mono text-sm text-lbs-accent-3">
                {state.hintOpen ? "PAUSED · " : ""}
                {Math.ceil(remain / 1000)}s
                {state.phase === "prompting" ? ` · ${liveMultiplier}` : ""}
              </p>
            ) : null}
            {state.phase === "prompting" && !you.played && remain <= AUTO_PLAY_NOTICE_MS ? (
              // Same rule as timeoutHuman in engine.ts: at 0s the selected card
              // plays, or the first card in hand if none is selected, and it is
              // judged like any other play.
              <p
                role="status"
                className="mx-auto mt-2 max-w-md rounded-md border border-warning/50 px-3 py-1.5 text-pretty text-sm leading-5 text-warning"
              >
                {state.selectedCardId
                  ? "Under 10s. When time runs out, your selected card plays. If it is wrong, you lose a life."
                  : "Under 10s. No card selected: when time runs out, the first card in your hand plays. If it is wrong, you lose a life."}
              </p>
            ) : null}
            {you.played ? (
              <PlayReveal
                state={state}
                revealing={revealing}
                onContinue={
                  state.phase === "resolving" && !state.lastAnswerCorrect
                    ? onNext
                    : undefined
                }
              />
            ) : null}
          </div>

          <div className="grid grid-cols-2 justify-items-center gap-2 overflow-x-auto sm:grid-cols-3 sm:gap-3">
            <PlayerSeat
              player={byId.ascii8}
              bot={BOTS.find((bot) => bot.id === "ascii8")}
              accused={state.accusedIds.includes("ascii8")}
              stamp={stampFor(state, "ascii8")}
              missed={missedCall(state, "ascii8")}
              canAccuse={canAccuse && !byId.ascii8?.eliminated}
              difficulty={prompt?.difficulty}
              onAccuse={() => onAccuse("ascii8")}
            />
            <div className="hidden sm:block" />
            <PlayerSeat
              player={byId.nullptr}
              bot={BOTS.find((bot) => bot.id === "nullptr")}
              accused={state.accusedIds.includes("nullptr")}
              stamp={stampFor(state, "nullptr")}
              missed={missedCall(state, "nullptr")}
              canAccuse={canAccuse && !byId.nullptr?.eliminated}
              difficulty={prompt?.difficulty}
              onAccuse={() => onAccuse("nullptr")}
            />
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          <div className="rounded-xl border border-lbs-line bg-lbs-well p-3">
            <p className="text-xs tracking-wide text-lbs-text-2">Table log</p>
            <ul className="mt-2 grid max-h-56 gap-2 overflow-auto pr-1 text-sm">
              {state.logs.slice(-8).map((entry) => (
                <li
                  key={entry.id}
                  className={cn(
                    "leading-5",
                    entry.tone === "good" && "text-success",
                    entry.tone === "bad" && "text-lbs-bad-2",
                    entry.tone === "warn" && "text-warning",
                    entry.tone === "neutral" && "text-lbs-text-2",
                  )}
                >
                  {entry.text}
                </li>
              ))}
            </ul>
          </div>
          {state.phase === "accusing" ? (
            <Button onClick={onResolveNow}>Lock accusations</Button>
          ) : null}
          {state.phase === "resolving" ? (
            <Button onClick={onNext}>Next round</Button>
          ) : null}
          {state.phase === "gameover" ? (
            <div className="rounded-xl border border-lbs-accent-2/30 bg-lbs-well-strong p-4">
              <p className="font-mono text-[10px] tracking-[0.2em] text-lbs-accent-2">
                TABLE CLOSED
              </p>
              <p className="mt-2 text-lg text-lbs-text-hi">
                {state.winnerId === "you"
                  ? "You still have a life. Every bot is out."
                  : "You lost your last life. The models still hold the table."}
              </p>
              <p className="mt-1 font-mono text-lbs-accent-2">Score {state.score}</p>
              <RunSummary
                stats={runStats}
                score={state.score}
                correctCalls={state.correctCalls}
                previousBest={previousBest}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {onPlayAgain ? (
                  <Button onClick={onPlayAgain}>One more game</Button>
                ) : null}
                <Button variant={onPlayAgain ? "outline" : "default"} onClick={onQuit}>
                  {state.winnerId === "you" ? "Take the win" : "Try another table"}
                </Button>
                <MainMenuButton />
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      <section className="mt-auto border-t border-lbs-line bg-lbs-well px-3 py-4 sm:px-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-lbs-text-dim">
            Your hand · {you.hand.length} cards
          </p>
          <Button size="lg" disabled={!canPlay} onClick={onPlay}>
            Play selected card
          </Button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {you.hand.length === 0 ? (
            <p className="text-sm text-lbs-text-3">
              {you.played
                ? "Card is on the table. Call a wrong bot to take a life."
                : "No cards left in hand."}
            </p>
          ) : (
            you.hand.map((card) => (
              <EncodingCard
                key={card.id}
                card={card}
                selected={state.selectedCardId === card.id}
                disabled={state.phase !== "prompting" || Boolean(you.played)}
                difficulty={prompt?.difficulty}
                onClick={
                  state.phase === "prompting" && !you.played
                    ? () => onSelect(card.id)
                    : undefined
                }
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function RunSummary({
  stats,
  score,
  correctCalls,
  previousBest,
}: {
  stats?: RunStats;
  score: number;
  correctCalls: number;
  previousBest: number | null;
}) {
  const rows: { label: string; value: string }[] = [];
  if (stats && stats.answered > 0) {
    rows.push({
      label: "Right answers",
      value: `${stats.correct}/${stats.answered} (${Math.round((stats.correct / stats.answered) * 100)}%)`,
    });
  }
  if (stats?.fastestMs != null) {
    rows.push({
      label: "Fastest right answer",
      value: `${(stats.fastestMs / 1000).toFixed(1)}s`,
    });
  }
  rows.push({ label: "Correct calls", value: String(correctCalls) });
  if (previousBest == null) {
    rows.push({ label: "Your best here", value: "First saved score" });
  } else {
    const diff = score - previousBest;
    rows.push({
      label: `Your best here (${previousBest})`,
      value: diff > 0 ? `New best, +${diff}` : diff === 0 ? "Tied" : `${diff}`,
    });
  }
  return (
    <dl className="mt-3 grid gap-1.5 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3">
          <dt className="text-lbs-text-2">{row.label}</dt>
          <dd className="font-mono text-lbs-text-hi">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ArcadeBanner({ win }: { win: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-40 flex justify-center px-4">
      <p
        className={cn(
          "lbs-arcade rounded-sm border-2 bg-lbs-banner px-6 py-2 font-mono text-3xl font-black tracking-[0.28em] sm:text-5xl",
          win
            ? "border-lbs-win text-lbs-win shadow-[0_0_28px_var(--lbs-win-glow)]"
            : "border-lbs-lose text-lbs-lose shadow-[0_0_28px_var(--lbs-lose-glow)]",
        )}
      >
        {win ? "YOU WIN" : "YOU LOSE"}
      </p>
    </div>
  );
}

function PlayReveal({
  state,
  revealing,
  onContinue,
}: {
  state: GameState;
  revealing: boolean;
  onContinue?: () => void;
}) {
  const you = youPlayer(state);
  const played = you.played;
  if (!played) return null;
  const prompt = state.prompt;
  const correctCard = state.correctCard;
  const showAnswerCard =
    revealing && !state.lastAnswerCorrect && correctCard && correctCard.id !== played.id;
  const explanation =
    revealing && !state.lastAnswerCorrect && prompt && correctCard
      ? explainFromCard(prompt, correctCard)
      : null;

  return (
    <div
      className={cn(
        "mt-4",
        revealing && state.lastAnswerCorrect && "lbs-glow rounded-2xl p-2",
        revealing && !state.lastAnswerCorrect && "lbs-shake",
      )}
    >
      <div className="flex flex-wrap items-end justify-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <p className="font-mono text-[10px] tracking-[0.18em] text-lbs-text-2">
            YOUR PLAY
          </p>
          <EncodingCard
            card={played}
            compact
            selected
            difficulty={prompt?.difficulty}
            stamped={revealing ? stampFor(state, "you") : null}
          />
        </div>
        {showAnswerCard ? (
          <div className="flex flex-col items-center gap-1">
            <p className="font-mono text-[10px] tracking-[0.18em] text-success/80">
              FROM YOUR HAND
            </p>
            <EncodingCard
              card={correctCard}
              compact
              stamped="exact"
              difficulty={prompt?.difficulty}
            />
          </div>
        ) : null}
      </div>
      {explanation ? (
        <p className="mt-3 text-pretty text-sm leading-5 text-lbs-text-dim">
          {explanation}
        </p>
      ) : null}
      {onContinue ? (
        <Button className="mt-3" size="sm" onClick={onContinue}>
          Continue
        </Button>
      ) : null}
    </div>
  );
}

function stampFor(state: GameState, id: string) {
  const player = state.players.find((item) => item.id === id);
  if (!player || player.eliminated) return null;
  if (state.phase !== "resolving" && state.phase !== "gameover") return null;
  if (!player.played || !state.prompt) return null;
  if (!state.prompt.matchGlyphs && !state.prompt.matchValues) return null;
  return matchQuality(player.played, state.prompt);
}

// A bot that played a wrong card (close or miss) which the player did not
// call: the same seats resolveRound logs as "You did not call them".
function missedCall(state: GameState, id: string) {
  if (state.accusedIds.includes(id)) return false;
  const stamp = stampFor(state, id);
  return stamp === "close" || stamp === "miss";
}
