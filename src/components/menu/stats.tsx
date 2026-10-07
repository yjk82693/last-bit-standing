"use client";

import { useSpacetimeDB, useTable } from "spacetimedb/react";
import { tables } from "@/module_bindings";
import type { Player } from "@/module_bindings/types";

export function accuracyOf(p: Player): string {
  if (p.totalAnswers === 0) return "n/a";
  return `${Math.round((p.correctAnswers / p.totalAnswers) * 100)}%`;
}

export function rankedPlayers(players: readonly Player[]): Player[] {
  return players
    .filter((p) => p.registered)
    .sort((a, b) => b.rating - a.rating || b.wins - a.wins || a.name.localeCompare(b.name));
}

export function ProfileCard() {
  const conn = useSpacetimeDB();
  const [players, ready] = useTable(tables.player);
  const me = conn.identity
    ? players.find((p) => conn.identity && p.identity.isEqual(conn.identity))
    : undefined;

  if (!ready || !me) {
    return <p className="text-sm text-zinc-500">Loading your stats...</p>;
  }
  const rank = rankedPlayers(players).findIndex((p) => p.identity.isEqual(me.identity)) + 1;
  const stats = [
    { label: "Rating", value: me.rating.toString() },
    { label: "Rank", value: rank > 0 ? `#${rank}` : "n/a" },
    { label: "Wins", value: me.wins.toString() },
    { label: "Matches", value: me.matches.toString() },
    { label: "Accuracy", value: accuracyOf(me) },
  ];
  return (
    <div className="space-y-3">
      <p className="text-zinc-100">
        <span className="text-zinc-400">Playing as </span>
        <span className="font-medium">{me.name}</span>
      </p>
      <dl className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
            <dt className="text-xs text-zinc-500">{s.label}</dt>
            <dd className="font-mono text-lg text-amber-200">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function LeaderboardTable({ limit = 50 }: { limit?: number }) {
  const conn = useSpacetimeDB();
  const [players, ready] = useTable(tables.player);
  if (!ready) return <p className="text-sm text-zinc-500">Loading leaderboard...</p>;
  const ranked = rankedPlayers(players).slice(0, limit);
  if (ranked.length === 0) {
    return <p className="text-sm text-zinc-500">No ranked players yet. Be the first.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-zinc-500">
          <tr>
            <th className="py-2 pr-3">#</th>
            <th className="py-2 pr-3">Player</th>
            <th className="py-2 pr-3 text-right">Rating</th>
            <th className="py-2 pr-3 text-right">W / M</th>
            <th className="py-2 text-right">Accuracy</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {ranked.map((p, i) => {
            const isMe = conn.identity ? p.identity.isEqual(conn.identity) : false;
            return (
              <tr key={p.identity.toHexString()} className={isMe ? "bg-amber-300/10" : undefined}>
                <td className="py-2 pr-3 font-mono text-zinc-500">{i + 1}</td>
                <td className="py-2 pr-3 text-zinc-100">
                  {p.name}
                  {isMe && <span className="ml-2 text-xs text-amber-300">you</span>}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-amber-200">{p.rating}</td>
                <td className="py-2 pr-3 text-right font-mono text-zinc-300">
                  {p.wins} / {p.matches}
                </td>
                <td className="py-2 text-right font-mono text-zinc-300">{accuracyOf(p)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
