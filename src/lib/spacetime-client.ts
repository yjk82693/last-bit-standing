import { DbConnection, tables } from "@/module_bindings";

const GUEST_TOKEN_KEY = "lbs-spacetime-guest-token";

export const SPACETIME_URI =
  process.env.NEXT_PUBLIC_SPACETIMEDB_URI ?? "wss://maincloud.spacetimedb.com";
export const SPACETIME_DB =
  process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ?? "last-bit-standing";

function readGuestToken(): string | undefined {
  try {
    return window.localStorage.getItem(GUEST_TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

// Browser-only. With an idToken (signed in) the identity comes from your
// email account, so it is the same on every device. Without one, a saved
// guest token keeps a stable anonymous identity in this browser.
export function makeConnectionBuilder(idToken?: string) {
  return DbConnection.builder()
    .withUri(SPACETIME_URI)
    .withDatabaseName(SPACETIME_DB)
    .withToken(idToken ?? readGuestToken())
    .onConnect((conn, _identity, token) => {
      if (!idToken) {
        try {
          window.localStorage.setItem(GUEST_TOKEN_KEY, token);
        } catch {}
      }
      conn
        .subscriptionBuilder()
        .subscribe([tables.player, tables.room, tables.seat]);
    })
    .onConnectError((_ctx, err) => {
      console.error("SpacetimeDB connect error", err);
    });
}

// Drops this browser's guest identity; the next guest connection gets a new one.
export function forgetGuestToken() {
  try {
    window.localStorage.removeItem(GUEST_TOKEN_KEY);
  } catch {}
}
