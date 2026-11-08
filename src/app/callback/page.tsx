"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "react-oidc-context";

// Finishes the sign-in from the URL, then goes to the menu. If something
// fails, it says why instead of waiting forever.
function CallbackStatus() {
  const auth = useAuth();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) window.location.replace("/");
  }, [auth.isLoading, auth.isAuthenticated]);

  if (auth.error || slow) {
    return (
      <div className="mx-auto max-w-xl space-y-3 px-4 py-16 text-lbs-text-dim">
        <p className="font-medium text-lbs-bad">Sign-in did not finish.</p>
        <p className="text-sm text-lbs-text-2">
          {auth.error?.message ??
            "No answer from the sign-in server. If you opened the email link in a different browser, open it in the one where you started."}
        </p>
        <button
          type="button"
          onClick={() => window.location.replace("/")}
          className="rounded-md border border-lbs-line-control px-3 py-1.5 text-sm text-lbs-text hover:bg-lbs-line-solid"
        >
          Back to start
        </button>
      </div>
    );
  }
  return <p className="mx-auto max-w-xl px-4 py-16 text-lbs-text-2">Signing you in...</p>;
}

const Callback = dynamic(
  () =>
    import("@/components/auth/auth-shell").then((m) => {
      const Shell = m.AuthShell;
      return function CallbackScreen() {
        return (
          <Shell>
            <CallbackStatus />
          </Shell>
        );
      };
    }),
  { ssr: false },
);

export default function CallbackPage() {
  return <Callback />;
}
