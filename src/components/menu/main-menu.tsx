"use client";

import Link from "next/link";
import { useAuth } from "react-oidc-context";
import { Swords, Trophy, User, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth/auth-shell";
import { SpacetimeShell } from "@/components/auth/spacetime-shell";
import { ProfileCard } from "@/components/menu/stats";

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
  const email = auth.user?.profile.email;

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
        <div className="flex items-center gap-3 text-sm">
          {auth.isLoading ? (
            <span className="text-zinc-500">Checking sign-in...</span>
          ) : signedIn ? (
            <>
              <span className="text-zinc-400">{email}</span>
              <Button size="sm" variant="ghost" onClick={() => void auth.signoutRedirect()}>
                <LogOut className="size-4" /> Sign out
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => void auth.signinRedirect()}>
              <LogIn className="size-4" /> Sign in with email
            </Button>
          )}
        </div>
      </header>

      {auth.error && (
        <p className="text-sm text-red-300">Sign-in problem: {auth.error.message}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <MenuCard
          href="/solo"
          icon={<User className="size-5" />}
          title="Solo"
          blurb="You against five bots. No account needed."
        />
        <MenuCard
          href={signedIn ? "/multiplayer" : undefined}
          onLockedClick={() => void auth.signinRedirect()}
          icon={<Swords className="size-5" />}
          title="Multiplayer"
          blurb={signedIn ? "Quick match, custom rooms, room codes." : "Sign in with your email to play."}
        />
        <MenuCard
          href="/leaderboard"
          icon={<Trophy className="size-5" />}
          title="Leaderboard"
          blurb="Ranked rating, wins, and accuracy."
        />
      </div>

      {signedIn && (
        <Panel>
          <h2 className="text-lg font-medium text-zinc-100">Your profile</h2>
          <SpacetimeShell idToken={auth.user!.id_token}>
            <ProfileCard />
          </SpacetimeShell>
        </Panel>
      )}
    </div>
  );
}

function MenuCard({
  href,
  onLockedClick,
  icon,
  title,
  blurb,
}: {
  href?: string;
  onLockedClick?: () => void;
  icon: React.ReactNode;
  title: string;
  blurb: string;
}) {
  const body = (
    <div className="flex h-full flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 transition hover:border-amber-300/50 hover:bg-zinc-900">
      <div className="flex items-center gap-2 text-amber-200">
        {icon}
        <span className="text-lg font-medium text-zinc-50">{title}</span>
      </div>
      <p className="text-sm text-zinc-400">{blurb}</p>
    </div>
  );
  if (href) return <Link href={href}>{body}</Link>;
  return (
    <button type="button" className="text-left" onClick={onLockedClick}>
      {body}
    </button>
  );
}
