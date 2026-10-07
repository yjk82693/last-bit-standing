"use client";

import { useMemo } from "react";
import { SpacetimeDBProvider } from "spacetimedb/react";
import { makeConnectionBuilder } from "@/lib/spacetime-client";

// Remounts (and reconnects) whenever the token changes, e.g. after sign-in.
export function SpacetimeShell({
  idToken,
  children,
}: {
  idToken?: string;
  children: React.ReactNode;
}) {
  const builder = useMemo(() => makeConnectionBuilder(idToken), [idToken]);
  return (
    <SpacetimeDBProvider key={idToken ?? "guest"} connectionBuilder={builder}>
      {children}
    </SpacetimeDBProvider>
  );
}
