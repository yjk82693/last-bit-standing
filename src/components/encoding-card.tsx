"use client";

import { cn } from "@/lib/utils";
import type { CardDef, Difficulty, MatchQuality } from "@/lib/types";
import { cardCaption } from "@/lib/card-text";

const encodingLabel = {
  binary: "BINARY",
  hex: "HEX",
  ascii: "ASCII",
} as const;

const rarityPips = {
  common: "•",
  uncommon: "••",
  rare: "★★",
};

export function EncodingCard({
  card,
  selected = false,
  disabled = false,
  stamped,
  compact = false,
  difficulty,
  onClick,
}: {
  card: CardDef;
  selected?: boolean;
  disabled?: boolean;
  stamped?: MatchQuality | "accused" | null;
  compact?: boolean;
  difficulty?: Difficulty | null;
  onClick?: () => void;
}) {
  const caption = cardCaption(card, difficulty);
  // The stamp sits under the card button, not inside it: a dimmed (disabled)
  // card does not dim its stamp, and the stamp never covers the card's value.
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        // Display-only cards (no onClick) stay out of the Tab order.
        disabled={disabled || !onClick}
        data-focus-ring="inset"
        className={cn(
          "relative flex shrink-0 flex-col overflow-hidden rounded-xl border text-left shadow-[0_10px_24px_-12px_var(--lbs-card-shadow)] transition-all",
          compact
            ? "h-[132px] w-[90px] p-2 sm:h-[148px] sm:w-[102px] lg:h-[160px] lg:w-[110px]"
            : "h-[236px] w-[164px] p-3",
          (card.encoding ?? "binary") === "binary" &&
            "border-lbs-card-edge-binary bg-linear-to-b from-lbs-card-binary to-lbs-card-base",
          card.encoding === "hex" &&
            "border-lbs-card-edge-hex bg-linear-to-b from-lbs-card-hex to-lbs-card-base",
          card.encoding === "ascii" &&
            "border-lbs-card-edge-ascii bg-linear-to-b from-lbs-card-ascii to-lbs-card-base",
          selected &&
            !compact &&
            "z-10 border-lbs-card-selected ring-2 ring-inset ring-lbs-card-selected",
          selected &&
            compact &&
            "border-lbs-card-selected ring-2 ring-inset ring-lbs-card-selected",
          disabled && !selected && "opacity-60",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-2 font-mono text-[10px] tracking-[0.18em]",
            (card.encoding ?? "binary") === "binary" && "text-lbs-card-label-binary",
            card.encoding === "hex" && "text-lbs-card-label-hex",
            card.encoding === "ascii" && "text-lbs-card-label-ascii",
          )}
        >
          <span>{encodingLabel[card.encoding] ?? "CARD"}</span>
          <span className="text-lbs-card-ink-2/70">{rarityPips[card.rarity]}</span>
        </div>
        <div
          className={cn(
            "mt-2 font-mono leading-none text-lbs-card-ink",
            compact ? "text-lg" : "text-2xl",
            card.encoding === "ascii" && !compact && "text-5xl",
            card.encoding === "ascii" && compact && "text-3xl",
          )}
        >
          {card.glyph}
        </div>
        <div className="mt-auto">
          <p
            className={cn(
              "font-medium tracking-wide text-lbs-card-ink-2",
              compact ? "text-[11px]" : "text-sm",
            )}
          >
            {card.name}
          </p>
          {caption ? (
            <p
              className={cn(
                "mt-1 text-pretty text-lbs-card-ink-2/70",
                compact ? "line-clamp-3 text-[9px] leading-3" : "text-xs leading-4",
              )}
            >
              {caption}
            </p>
          ) : null}
        </div>
      </button>
      {stamped ? (
        <div
          className={cn(
            "pointer-events-none w-full rounded border-2 bg-lbs-stamp py-0.5 text-center font-mono text-xs font-bold tracking-[0.2em] opacity-100",
            stamped === "exact" && "border-lbs-correct text-lbs-correct-ink",
            stamped === "close" && "border-lbs-close text-lbs-close-ink",
            stamped === "miss" && "border-lbs-wrong text-lbs-wrong-ink",
            stamped === "accused" && "border-lbs-called text-lbs-called-ink",
          )}
        >
          {stamped === "exact"
            ? "MATCH"
            : stamped === "close"
              ? "CLOSE"
              : stamped === "accused"
                ? "CALLED"
                : "WRONG"}
        </div>
      ) : null}
    </div>
  );
}
