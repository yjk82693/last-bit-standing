"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducer, useTable } from "spacetimedb/react";
import type { Identity } from "spacetimedb";
import { Flag, Lock, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EncodingCard } from "@/components/encoding-card";
import { HealthPips } from "@/components/player-seat";
import { MainMenuButton } from "@/components/main-menu-button";
import { PROMPTS } from "@/lib/catalog";
import { reducers, tables } from "@/module_bindings";
import type { Player, Room } from "@/module_bindings/types";
import type { CardDef, Difficulty } from "@/lib/types";
import { cn } from "@/lib/utils";

const PHASE_LABEL: Record<string, string> = {
  play: "Pick your card",
  call: "Call the wrong cards",
  reveal: "Results",
  over: "Match over",
};

const TONE: Record<string, string> = {
  good: "text-success",
  bad: "text-lbs-bad",
  warn: "text-warning",
  neutral: "text-lbs-text-2",
};

function useNow(intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function useAction() {
  const [error, setError] = useState<string | null>(null);
  const run = (p: Promise<void>) => {
    setError(null);
    p.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };
  return { error, run };
}

function asCard(c: {
  cardId?: string;
  encoding: string;
  glyph: string;
  value: number;
  name: string;
  flavor?: string;
  rarity: string;
}): CardDef {
  return {
    id: c.cardId ?? c.glyph,
    encoding: c.encoding as CardDef["encoding"],
    glyph: c.glyph,
    value: c.value,
    name: c.name,
    flavor: c.flavor ?? "",
    rarity: c.rarity as CardDef["rarity"],
  };
}

// The live table for a started (or finished) multiplayer match. Everything
// shown here comes from the server; this component only sends player actions.
export function MatchTable({
  room,
  players,
  me,
}: {
  room: Room;
  players: readonly Player[];
  me: Identity;
}) {
  const [matches] = useTable(tables.match);
  const [states] = useTable(tables.matchSeat);
  const [events] = useTable(tables.matchEvent);
  const [seats] = useTable(tables.seat);
  const [hand] = useTable(tables.myHand);
  const [plays] = useTable(tables.myPlay);
  const [calls] = useTable(tables.myCalls);
  const playCard = useReducer(reducers.playCard);
  const toggleCall = useReducer(reducers.toggleCall);
  const lockCalls = useReducer(reducers.lockCalls);
  const forfeit = useReducer(reducers.forfeit);
  const leave = useReducer(reducers.leaveRoom);
  const { error, run } = useAction();
  const now = useNow();
  const [selected, setSelected] = useState<bigint | null>(null);

  const match = matches.find((m) => m.roomId === room.id);
  const roomSeats = useMemo(
    () => seats.filter((s) => s.roomId === room.id).sort((a, b) => a.seatIndex - b.seatIndex),
    [seats, room.id],
  );
  const mySeat = roomSeats.find((s) => s.identity.isEqual(me));
  const stateOf = (seatId: bigint) => states.find((x) => x.seatId === seatId);
  const nameOf = (id: Identity) => players.find((p) => p.identity.isEqual(id))?.name ?? "Player";
  const myState = mySeat ? stateOf(mySeat.id) : undefined;
  const myHand = mySeat ? hand.filter((h) => h.seatId === mySeat.id) : [];
  const myPlay = mySeat ? plays.find((p) => p.seatId === mySeat.id) : undefined;
  const calledIds = new Set(mySeat ? calls.filter((c) => c.callerSeatId === mySeat.id).map((c) => c.targetSeatId) : []);
  const roomEvents = events
    .filter((e) => e.roomId === room.id)
    .sort((a, b) => Number(b.id - a.id))
    .slice(0, 14);

  if (!match || !mySeat) {
    return <p className="text-lbs-text-2">Dealing the cards...</p>;
  }

  const prompt = PROMPTS.find((p) => p.id === match.promptId);
  const difficulty = (prompt?.difficulty ?? "medium") as Difficulty;
  const secondsLeft = Math.max(0, Math.ceil((Number(match.phaseEndsAt.toMillis()) - now) / 1000));
  const out = mySeat.eliminated;
  const over = match.phase === "over";
  const faceUp = match.phase === "call" || match.phase === "reveal" || over;

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border border-lbs-line-solid bg-lbs-panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs tracking-[0.2em] text-lbs-accent-2/80">
              {room.name.toUpperCase()} · ROUND {match.round}
            </span>
            <Badge variant="secondary">{PHASE_LABEL[match.phase] ?? match.phase}</Badge>
          </div>
          {!over && (
            <span className={cn("font-mono text-2xl", secondsLeft <= 5 ? "text-lbs-bad" : "text-lbs-text")}>
              {secondsLeft}s
            </span>
          )}
        </div>
        <p className="text-xl font-medium text-lbs-text-hi sm:text-2xl">{prompt?.text ?? "..."}</p>
        {match.answer && (
          <p className="text-sm text-lbs-text-2">
            Answer: <span className="font-mono text-lbs-accent-2">{match.answer}</span>
          </p>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roomSeats.map((s) => {
          const st = stateOf(s.id);
          const isMe = s.id === mySeat.id;
          const called = calledIds.has(s.id);
          const canCall = match.phase === "call" && !isMe && !out && !s.eliminated && !myState?.locked;
          return (
            <div
              key={s.id.toString()}
              className={cn(
                "space-y-3 rounded-xl border bg-lbs-panel p-4",
                isMe ? "border-lbs-accent/40" : "border-lbs-line-solid",
                s.eliminated && "opacity-50",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-lbs-text">{nameOf(s.identity)}</span>
                  {isMe && <Badge variant="secondary">you</Badge>}
                  {s.eliminated && <Badge variant="outline">out</Badge>}
                </div>
                <HealthPips health={s.health} />
              </div>

              <div className="flex min-h-[132px] items-center gap-3">
                {faceUp && st?.cardGlyph ? (
                  <EncodingCard
                    compact
                    card={asCard({
                      encoding: st.cardEncoding,
                      glyph: st.cardGlyph,
                      value: st.cardValue,
                      name: st.cardName,
                      rarity: st.cardRarity,
                    })}
                    difficulty={difficulty}
                    stamped={
                      match.phase === "call"
                        ? called ? "accused" : null
                        : st.wasCorrect ? "exact" : "miss"
                    }
                    onClick={canCall ? () => run(toggleCall({ targetSeatId: s.id })) : undefined}
                    disabled={!canCall}
                  />
                ) : (
                  <p className="text-sm text-lbs-text-3">
                    {s.eliminated ? "Out of lives" : st?.played ? "Card down" : "Choosing..."}
                  </p>
                )}
                <div className="space-y-2 text-xs text-lbs-text-2">
                  <p className="font-mono text-lbs-accent-2">{st?.score ?? 0} pts</p>
                  {canCall && (
                    <Button
                      size="sm"
                      variant={called ? "default" : "outline"}
                      onClick={() => run(toggleCall({ targetSeatId: s.id }))}
                    >
                      <Megaphone className="size-3.5" /> {called ? "Called" : "Call wrong"}
                    </Button>
                  )}
                  {match.phase === "call" && st?.locked && <p>Locked in</p>}
                  {(match.phase === "reveal" || over) && st?.lastResult && <p>{st.lastResult}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {match.phase === "play" && !out && (
        <section className="space-y-3 rounded-xl border border-lbs-line-solid bg-lbs-panel p-5">
          {myPlay ? (
            <p className="text-lbs-text-dim">Card down. Waiting for the others...</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-medium text-lbs-text">Your hand</h2>
                <Button disabled={selected === null} onClick={() => selected !== null && run(playCard({ handId: selected }))}>
                  Play card
                </Button>
              </div>
              <div className="flex flex-wrap gap-3">
                {myHand
                  .slice()
                  .sort((a, b) => Number(a.id - b.id))
                  .map((h) => (
                    <EncodingCard
                      key={h.id.toString()}
                      compact
                      card={asCard(h)}
                      difficulty={difficulty}
                      selected={selected === h.id}
                      onClick={() => setSelected(h.id)}
                    />
                  ))}
              </div>
            </>
          )}
        </section>
      )}

      {match.phase === "call" && !out && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-lbs-line-solid bg-lbs-panel p-5">
          <p className="text-sm text-lbs-text-2">
            Tap every card you think is wrong. A wrong card nobody calls costs everyone who missed it a life.
            A false call costs you one.
          </p>
          <Button disabled={myState?.locked} onClick={() => run(lockCalls())}>
            <Lock className="size-4" /> {myState?.locked ? "Locked in" : `Lock in ${calledIds.size} call${calledIds.size === 1 ? "" : "s"}`}
          </Button>
        </section>
      )}

      {over && (
        <section className="space-y-3 rounded-xl border border-lbs-accent/30 bg-lbs-accent/5 p-5">
          <h2 className="text-lg font-medium text-lbs-text">Final standings</h2>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-lbs-text-3">
              <tr>
                <th className="py-1 pr-3">#</th>
                <th className="py-1 pr-3">Player</th>
                <th className="py-1 pr-3 text-right">Points</th>
                <th className="py-1 text-right">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-lbs-line-solid">
              {roomSeats
                .map((s) => ({ s, st: stateOf(s.id) }))
                .sort((a, b) => (a.st?.place ?? 99) - (b.st?.place ?? 99))
                .map(({ s, st }) => {
                  const delta = (st?.ratingAfter ?? 0) - (st?.ratingBefore ?? 0);
                  return (
                    <tr key={s.id.toString()} className={s.id === mySeat.id ? "bg-lbs-accent/10" : undefined}>
                      <td className="py-2 pr-3 font-mono text-lbs-text-2">{st?.place ?? "-"}</td>
                      <td className="py-2 pr-3 text-lbs-text">{nameOf(s.identity)}</td>
                      <td className="py-2 pr-3 text-right font-mono text-lbs-accent-2">{st?.score ?? 0}</td>
                      <td className="py-2 text-right font-mono text-lbs-text-dim">
                        {st?.ratingAfter ?? 0}{" "}
                        <span className={delta >= 0 ? "text-success" : "text-lbs-bad"}>
                          ({delta >= 0 ? "+" : ""}{delta})
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => run(leave())}>Back to lobby</Button>
            <MainMenuButton />
          </div>
        </section>
      )}

      <section className="space-y-2 rounded-xl border border-lbs-line-solid bg-lbs-panel-soft p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-lbs-text-dim">Table log</h2>
          {!over && !out && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (window.confirm("Forfeit this match? You will place by when you left, and it counts for your rating.")) {
                  run(forfeit());
                }
              }}
            >
              <Flag className="size-3.5" /> Forfeit
            </Button>
          )}
        </div>
        <ul className="space-y-1 text-sm">
          {roomEvents.map((e) => (
            <li key={e.id.toString()} className={TONE[e.tone] ?? TONE.neutral}>
              <span className="mr-2 font-mono text-xs text-lbs-text-4">r{e.round}</span>
              {e.text}
            </li>
          ))}
        </ul>
      </section>

      {error && <p className="text-sm text-lbs-bad">{error}</p>}
    </div>
  );
}
