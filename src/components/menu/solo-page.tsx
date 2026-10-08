"use client";

import { useAuth } from "react-oidc-context";
import { useSpacetimeDB, useTable } from "spacetimedb/react";
import { tables } from "@/module_bindings";
import { GameApp } from "@/components/game-app";
import { AuthShell } from "@/components/auth/auth-shell";
import { SpacetimeShell } from "@/components/auth/spacetime-shell";

export function SoloPage() {
  return (
    <AuthShell>
      <Solo />
    </AuthShell>
  );
}

function Loading() {
  return <p className="mx-auto max-w-4xl px-4 py-10 text-zinc-500">Loading...</p>;
}

function Solo() {
  const auth = useAuth();
  if (auth.isLoading) return <Loading />;
  const idToken = auth.isAuthenticated ? auth.user?.id_token : undefined;
  // Guests and signed-out visitors play solo without a profile.
  if (!idToken) return <GameApp playerName="Guest" />;
  return (
    <SpacetimeShell idToken={idToken}>
      <SoloWithProfile />
    </SpacetimeShell>
  );
}

function SoloWithProfile() {
  const conn = useSpacetimeDB();
  const [players, ready] = useTable(tables.player);
  if (conn.connectionError) return <GameApp />;
  if (!ready || !conn.identity) return <Loading />;
  const me = players.find((p) => conn.identity && p.identity.isEqual(conn.identity));
  return <GameApp playerName={me?.name ?? "Operator"} />;
}
