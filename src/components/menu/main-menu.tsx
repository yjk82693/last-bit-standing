"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "react-oidc-context";
import { Binary, Swords, Trophy, User, UserRound, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { SpacetimeShell } from "@/components/auth/spacetime-shell";
import { ProfileCard, useMe } from "@/components/menu/stats";
import { GuestLinkClaimer, GuestSettings } from "@/components/menu/guest-settings";
import { BinaryBackdrop } from "@/components/auth/binary-backdrop";
import { useGuestMode } from "@/lib/guest";

export function MainMenuPage() {
  return (
    <AuthShell>
      <MainMenu />
    </AuthShell>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      {children}
    </section>
  );
}

function MainMenu() {
  const auth = useAuth();
  const signedIn = auth.isAuthenticated && Boolean(auth.user?.id_token);
  const [guest, setGuest] = useGuestMode();

  if (auth.isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-zinc-500">
        Checking sign-in...
      </div>
    );
  }
  if (signedIn) {
    return (
      <SpacetimeShell idToken={auth.user!.id_token}>
        <Menu />
      </SpacetimeShell>
    );
  }
  if (guest) {
    // No idToken: connects with this browser's guest identity.
    return (
      <SpacetimeShell>
        <Menu guest onExitGuest={() => setGuest(false)} />
      </SpacetimeShell>
    );
  }
  return <SignInScreen onGuest={() => setGuest(true)} />;
}

// Step 0: everyone starts here. Both tabs open SpacetimeAuth, where the
// player picks Google or email. A new email or Google account is
// registered automatically on its first sign-in.
function SignInScreen({ onGuest }: { onGuest: () => void }) {
  const auth = useAuth();
  const [tab, setTab] = useState<"signin" | "register">("signin");
  const copy =
    tab === "signin"
      ? { title: "Welcome back", body: "Pick up where you left off. Your rating and stats follow your account." }
      : { title: "Create your account", body: "One click with Google, or get a magic link by email. No password to remember." };

  return (
    <div className="relative min-h-screen">
      <BinaryBackdrop />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-4 py-10">
        <div className="space-y-2 text-center sm:-mx-24">
          <p className="font-mono text-xs tracking-[0.28em] text-amber-200/80">
            BINARY · HEX · ASCII
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
            Last Bit Standing
          </h1>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-2xl shadow-black/50 backdrop-blur">
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-950/70 p-1">
            {(["signin", "register"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={
                  "rounded-lg py-2 text-sm font-medium transition " +
                  (tab === t ? "bg-amber-300 text-zinc-950" : "text-zinc-400 hover:text-zinc-100")
                }
              >
                {t === "signin" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>

          <div className="space-y-4 p-4">
            <div className="space-y-1">
              <h2 className="text-lg font-medium text-zinc-100">{copy.title}</h2>
              <p className="text-sm text-zinc-400">{copy.body}</p>
            </div>
            <Button className="w-full" size="lg" onClick={() => void auth.signinRedirect()}>
              <LogIn className="size-4" />
              {tab === "signin" ? "Sign in with one click" : "Register with one click"}
            </Button>
            <p className="text-center text-xs text-zinc-500">
              Continue with Google or email on the next screen.
            </p>
            <div className="flex items-center gap-3 text-xs text-zinc-600">
              <span className="h-px flex-1 bg-zinc-800" />
              or
              <span className="h-px flex-1 bg-zinc-800" />
            </div>
            <Button className="w-full" variant="outline" onClick={onGuest}>
              <UserRound className="size-4" /> Play as guest
            </Button>
            <p className="text-center text-xs text-zinc-500">
              Get a random guest ID and play everything, multiplayer included. Link it to an
              account later from guest settings to keep your record.
            </p>
            {auth.error && (
              <p className="text-sm text-red-300">Sign-in problem: {auth.error.message}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Menu({ guest = false, onExitGuest }: { guest?: boolean; onExitGuest?: () => void }) {
  const auth = useAuth();
  const email = auth.user?.profile.email;
  const me = useMe();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:py-14">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="font-mono text-xs tracking-[0.28em] text-amber-200/80">
            BINARY · HEX · ASCII
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-6xl">
            Last Bit Standing
          </h1>
        </div>
        {guest ? (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            Guest
            <span className="font-mono text-amber-200">{me?.name ?? "..."}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-400">{email}</span>
            <Button size="sm" variant="ghost" onClick={() => void auth.signoutRedirect()}>
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MenuCard
          href="/solo"
          icon={<User className="size-5" />}
          title="Solo"
          blurb="You against five bots."
        />
        <MenuCard
          href="/multiplayer"
          icon={<Swords className="size-5" />}
          title="Multiplayer"
          blurb="Quick match, custom rooms, room codes."
        />
        <MenuCard
          href="/leaderboard"
          icon={<Trophy className="size-5" />}
          title="Leaderboard"
          blurb="Ranked rating, wins, and accuracy."
        />
        <MenuCard
          href="/bench"
          icon={<Binary className="size-5" />}
          title="Encoding bench"
          blurb="Binary, hex, and ASCII reference tables."
        />
      </div>

      <Panel>
        {guest ? (
          <>
            <h2 className="text-lg font-medium text-zinc-100">Guest settings</h2>
            <GuestSettings onExit={() => onExitGuest?.()} />
          </>
        ) : (
          <>
            <h2 className="text-lg font-medium text-zinc-100">Your profile</h2>
            <GuestLinkClaimer />
            <ProfileCard />
          </>
        )}
      </Panel>
    </div>
  );
}

function MenuCard({
  href,
  icon,
  title,
  blurb,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  blurb: string;
}) {
  return (
    <Link href={href}>
      <div className="flex h-full flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-amber-300/50 hover:bg-zinc-900">
        <div className="flex items-center gap-2 text-amber-200">
          {icon}
          <span className="text-lg font-medium text-zinc-50">{title}</span>
        </div>
        <p className="text-sm text-zinc-400">{blurb}</p>
      </div>
    </Link>
  );
}
