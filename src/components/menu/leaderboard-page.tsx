"use client";

import Link from "next/link";
import { useAuth } from "react-oidc-context";
import { AuthShell } from "@/components/auth/auth-shell";
import { SpacetimeShell } from "@/components/auth/spacetime-shell";
import { LeaderboardTable, ProfileCard } from "@/components/menu/stats";

export function LeaderboardPage() {
  return (
    <AuthShell>
      <Leaderboard />
    </AuthShell>
  );
}

function Leaderboard() {
  const auth = useAuth();
  if (auth.isLoading) {
    return <p className="mx-auto max-w-4xl px-4 py-10 text-zinc-500">Loading...</p>;
  }
  const idToken = auth.isAuthenticated ? auth.user?.id_token : undefined;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs tracking-[0.28em] text-amber-200/80">RANKED</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Leaderboard
          </h1>
        </div>
        <Link href="/" className="text-sm text-zinc-400 underline-offset-4 hover:underline">
          Main menu
        </Link>
      </header>
      <SpacetimeShell idToken={idToken}>
        {idToken && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
            <ProfileCard />
          </section>
        )}
        <section className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
          <LeaderboardTable />
        </section>
      </SpacetimeShell>
    </div>
  );
}
