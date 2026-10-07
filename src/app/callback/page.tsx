"use client";

import dynamic from "next/dynamic";

// AuthShell finishes the sign-in from the URL, then sends you to the menu.
const Callback = dynamic(
  () =>
    import("@/components/auth/auth-shell").then((m) => {
      const Shell = m.AuthShell;
      return function CallbackScreen() {
        return (
          <Shell>
            <p className="mx-auto max-w-xl px-4 py-16 text-zinc-400">Signing you in...</p>
          </Shell>
        );
      };
    }),
  { ssr: false },
);

export default function CallbackPage() {
  return <Callback />;
}
