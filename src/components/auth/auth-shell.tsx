"use client";

import { useMemo } from "react";
import { AuthProvider } from "react-oidc-context";
import { AUTH_CLIENT_ID, makeAuthConfig } from "@/lib/auth-config";

export function AuthShell({ children }: { children: React.ReactNode }) {
  // A full page load after sign-in, so every screen starts with the new session.
  const config = useMemo(() => makeAuthConfig(() => window.location.replace("/")), []);

  if (!AUTH_CLIENT_ID) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-zinc-300">
        <p className="font-medium text-red-300">Sign-in is not configured.</p>
        <p className="mt-2 text-sm text-zinc-400">
          Set <code className="font-mono">NEXT_PUBLIC_SPACETIMEAUTH_CLIENT_ID</code> in{" "}
          <code className="font-mono">.env.local</code> and restart the dev server.
        </p>
      </div>
    );
  }
  return <AuthProvider {...config}>{children}</AuthProvider>;
}
