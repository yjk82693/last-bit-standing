import { DbConnection, tables } from "@/module_bindings";

const TOKEN_KEY = "lbs-spacetime-token";

export const SPACETIME_URI =
  process.env.NEXT_PUBLIC_SPACETIMEDB_URI ?? "ws://127.0.0.1:3000";
export const SPACETIME_DB =
  process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ?? "last-bit-standing";

function readToken(): string | undefined {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

// Browser-only. The saved token keeps the same identity across refreshes,
// so a normal window and an incognito window act as two different players.
export function makeConnectionBuilder() {
  return DbConnection.builder()
    .withUri(SPACETIME_URI)
    .withDatabaseName(SPACETIME_DB)
    .withToken(readToken())
    .onConnect((conn, _identity, token) => {
      try {
        window.localStorage.setItem(TOKEN_KEY, token);
      } catch {}
      conn
        .subscriptionBuilder()
        .subscribe([tables.player, tables.room, tables.seat]);
    })
    .onConnectError((_ctx, err) => {
      console.error("SpacetimeDB connect error", err);
    });
}
