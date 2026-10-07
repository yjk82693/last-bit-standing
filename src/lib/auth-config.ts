import { WebStorageStateStore } from "oidc-client-ts";
import type { AuthProviderProps } from "react-oidc-context";

export const AUTH_CLIENT_ID = process.env.NEXT_PUBLIC_SPACETIMEAUTH_CLIENT_ID ?? "";

// Browser-only: reads window.location for the redirect URIs.
export function makeAuthConfig(onSignedIn: () => void): AuthProviderProps {
  const origin = window.location.origin;
  return {
    authority: "https://auth.spacetimedb.com/oidc",
    client_id: AUTH_CLIENT_ID,
    redirect_uri: `${origin}/callback`,
    post_logout_redirect_uri: `${origin}/`,
    // offline_access gives a refresh token so the session renews instead of expiring.
    scope: "openid profile email offline_access",
    response_type: "code",
    // localStorage so you stay signed in across tabs and restarts.
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    automaticSilentRenew: true,
    onSigninCallback: () => {
      window.history.replaceState({}, document.title, window.location.pathname);
      onSignedIn();
    },
  };
}
