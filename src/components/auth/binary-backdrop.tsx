"use client";

import { useMemo } from "react";

// Drop a real image at public/backgrounds/sign-in.jpg and set this to
// "/backgrounds/sign-in.jpg" to use it instead of the generated backdrop.
export const SIGN_IN_BACKGROUND_IMAGE: string | null = null;

const COLUMNS = 28;
const ROWS = 60;
const GLYPHS = ["0", "1", "0", "1", "A", "F", "7", "3", "#", "&"];

// Small seeded PRNG so the pattern is identical on every render.
function seeded(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

export function BinaryBackdrop() {
  const columns = useMemo(() => {
    const rand = seeded(42);
    return Array.from({ length: COLUMNS }, () => ({
      text: Array.from({ length: ROWS }, () => GLYPHS[Math.floor(rand() * GLYPHS.length)]).join("\n"),
      opacity: 0.04 + rand() * 0.1,
      offset: Math.floor(rand() * 60) - 30,
    }));
  }, []);

  if (SIGN_IN_BACKGROUND_IMAGE) {
    return (
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${SIGN_IN_BACKGROUND_IMAGE})` }}
      >
        <div className="absolute inset-0 bg-zinc-950/70" />
      </div>
    );
  }

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden bg-zinc-950">
      <div className="absolute inset-0 flex justify-between px-2 font-mono text-sm leading-6 text-amber-200">
        {columns.map((c, i) => (
          <pre
            key={i}
            className="m-0 whitespace-pre"
            style={{ opacity: c.opacity, transform: `translateY(${c.offset}px)` }}
          >
            {c.text}
          </pre>
        ))}
      </div>
      {/* darker middle keeps the title and card readable, warm glow around it */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_45%_55%_at_center,rgba(9,9,11,0.85),transparent_75%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.10),transparent_65%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(9,9,11,0.9)_95%)]" />
    </div>
  );
}
