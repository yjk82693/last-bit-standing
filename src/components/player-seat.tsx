"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, HeartCrack } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_HEALTH } from "@/lib/bots";
import { EncodingCard } from "@/components/encoding-card";
import type { BotDef, Difficulty, MatchQuality, PlayerState } from "@/lib/types";

const specialtyLabel = {
  binary: "BINARY",
  hex: "HEX",
  ascii: "ASCII",
} as const;

export function HealthPips({
  health,
  className,
  variant = "hearts",
  size = "seat",
}: {
  health: number;
  className?: string;
  // "bits" is theme B: lives read as 1 1 1 -> 1 1 0, so they do not depend
  // on colour. Every table uses it; "hearts" stays as the default variant.
  variant?: "hearts" | "bits";
  size?: "seat" | "hud";
}) {
  const previous = useRef(health);
  const [breaking, setBreaking] = useState<number[]>([]);

  useEffect(() => {
    if (health < previous.current) {
      const lost: number[] = [];
      for (let index = health; index < previous.current; index += 1) {
        lost.push(index);
      }
      setBreaking(lost);
      const timer = window.setTimeout(() => setBreaking([]), 720);
      previous.current = health;
      return () => window.clearTimeout(timer);
    }
    previous.current = health;
  }, [health]);

  if (variant === "bits") {
    return (
      <div
        role="img"
        className={cn(
          "flex items-center gap-0.5 font-mono font-bold leading-none",
          size === "hud" ? "text-[28px]" : "text-[20px]",
          className,
        )}
        aria-label={`${health} of ${MAX_HEALTH} lives`}
      >
        {Array.from({ length: MAX_HEALTH }).map((_, index) => {
          const filled = index < health;
          const cracked = breaking.includes(index);
          return (
            <span
              key={index}
              aria-hidden
              className={cn(
                "inline-block w-[0.62em] text-center",
                cracked && "lbs-heart-break text-lbs-life-break",
                filled && !cracked && "text-lbs-life",
                !filled && !cracked && "text-lbs-life-empty",
              )}
            >
              {filled ? "1" : "0"}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      aria-label={`${health} of ${MAX_HEALTH} lives`}
    >
      {Array.from({ length: MAX_HEALTH }).map((_, index) => {
        const filled = index < health;
        const cracked = breaking.includes(index);
        const Icon = cracked ? HeartCrack : Heart;
        return (
          <Icon
            key={index}
            className={cn(
              "size-3.5",
              cracked && "lbs-heart-break text-lbs-life-break",
              filled && !cracked && "fill-lbs-life text-lbs-life",
              !filled && !cracked && "text-lbs-life-empty",
            )}
          />
        );
      })}
    </div>
  );
}

export function PlayerSeat({
  player,
  bot,
  stamp,
  accused,
  missed = false,
  faceDown = false,
  onAccuse,
  canAccuse,
  difficulty,
}: {
  player?: PlayerState;
  bot?: BotDef;
  stamp?: MatchQuality | "accused" | null;
  accused?: boolean;
  // Reveal only: this bot played a wrong card and the player did not call it.
  missed?: boolean;
  // R1: the bot has played but its card stays face down for now.
  faceDown?: boolean;
  onAccuse?: () => void;
  canAccuse?: boolean;
  difficulty?: Difficulty | null;
}) {
  const wasEliminated = useRef(player?.eliminated ?? false);
  const [shaking, setShaking] = useState(false);

  useEffect(() => {
    if (!player) return;
    if (player.eliminated && !wasEliminated.current) {
      setShaking(true);
      const timer = window.setTimeout(() => setShaking(false), 900);
      wasEliminated.current = true;
      return () => window.clearTimeout(timer);
    }
    wasEliminated.current = player.eliminated;
  }, [player]);

  if (!player) return null;
  // stamp is only set in the reveal, for seats still in play; "close" counts
  // as wrong (only an exact match is right), same as resolveRound.
  const botWrong = Boolean(bot) && (stamp === "close" || stamp === "miss");
  const shown = player.eliminated
    ? player.lastPlayed ?? player.played
    : player.played;
  const allowAccuse = Boolean(canAccuse && !player.eliminated && player.played);

  return (
    <div
      className={cn(
        "flex min-w-0 max-w-[110px] flex-col items-center gap-1.5 sm:max-w-[118px] sm:gap-2",
        shaking && "lbs-eliminate",
      )}
    >
      <div
        className={cn(
          "flex w-full min-w-0 items-center gap-1 rounded-full border px-2 py-1 backdrop-blur-sm sm:px-2.5",
          player.eliminated
            ? "border-lbs-line-faint bg-lbs-seat-out"
            : "border-lbs-line bg-lbs-seat",
        )}
        style={
          player.eliminated
            ? undefined
            : {
                boxShadow: `0 0 0 1px color-mix(in srgb, ${bot?.accent ?? "var(--lbs-seat-accent)"} 13%, transparent)`,
              }
        }
      >
        <span
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            player.eliminated && "grayscale",
          )}
          style={{ background: bot?.accent ?? "var(--lbs-seat-accent)" }}
        />
        <div className="min-w-0">
          <p
            className={cn(
              "truncate font-medium leading-none",
              player.eliminated ? "text-lbs-text-3" : "text-lbs-text",
            )}
          >
            {player.name}
          </p>
          <p className="truncate text-[10px] text-lbs-text-3">
            {player.eliminated ? "Blocked" : (bot?.title ?? "Human operator")}
          </p>
        </div>
        <HealthPips health={player.health} variant="bits" />
      </div>
      {bot ? (
        <p
          className={cn(
            "max-w-full truncate font-mono text-[10px] font-semibold tracking-[0.14em]",
            player.eliminated && "text-lbs-text-3",
            !player.eliminated && bot.specialty === "binary" && "text-lbs-enc-binary",
            !player.eliminated && bot.specialty === "hex" && "text-lbs-enc-hex",
            !player.eliminated && bot.specialty === "ascii" && "text-lbs-enc-ascii",
          )}
        >
          <span aria-hidden>MAJOR · </span>
          <span className="sr-only">Specialty </span>
          {specialtyLabel[bot.specialty]}
        </p>
      ) : null}
      {missed ? (
        <p
          className="font-mono text-[10px] font-semibold tracking-[0.14em] text-warning"
          title="Wrong card, not called"
        >
          MISSED<span className="sr-only">: wrong card, not called</span>
        </p>
      ) : null}
      {shown && faceDown && !player.eliminated ? (
        <div
          role="img"
          aria-label={`${player.name} has played a card, face down`}
          className="flex h-[132px] w-[90px] items-center justify-center rounded-xl border border-lbs-card-back-line bg-lbs-card-back bg-[repeating-linear-gradient(45deg,transparent_0_6px,var(--lbs-card-back-line)_6px_7px)] font-mono text-[10px] tracking-[0.2em] text-lbs-text-2 shadow-[0_10px_24px_-12px_var(--lbs-card-shadow)] sm:h-[148px] sm:w-[102px] lg:h-[160px] lg:w-[110px]"
        >
          <span className="rounded bg-lbs-card-back px-1.5 py-0.5">FACE DOWN</span>
        </div>
      ) : shown ? (
        <div
          className={cn(
            "relative",
            missed && "rounded-xl outline-2 outline-offset-2 outline-warning outline-dashed",
          )}
        >
          <div className={cn(player.eliminated && "brightness-[0.42] saturate-50")}>
            <EncodingCard
              card={shown}
              compact
              difficulty={difficulty}
              stamped={player.eliminated ? null : accused ? "accused" : stamp}
              disabled={!allowAccuse}
              onClick={allowAccuse ? onAccuse : undefined}
            />
          </div>
          {player.eliminated ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between rounded-xl bg-lbs-seat-veil ring-1 ring-lbs-line">
              <span className="mt-2 rounded border border-lbs-line-muted bg-lbs-well-deep px-2 py-0.5 font-mono text-[10px] tracking-[0.22em] text-lbs-text-dim">
                OUT
              </span>
              <span className="mb-2 font-mono text-[9px] tracking-[0.16em] text-lbs-text-2">
                LAST PLAY
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex h-[132px] w-[90px] items-center justify-center rounded-xl border border-dashed border-lbs-card-back-line bg-lbs-card-back font-mono text-[10px] tracking-[0.2em] text-lbs-text-3 sm:h-[148px] sm:w-[102px] lg:h-[160px] lg:w-[110px]">
          WAITING
        </div>
      )}
      {botWrong && bot ? (
        <p className="w-full text-pretty text-center text-xs italic leading-4 text-lbs-text-2">
          <span className="sr-only">{bot.name} says: </span>
          &ldquo;{bot.blurb}&rdquo;
        </p>
      ) : null}
    </div>
  );
}
