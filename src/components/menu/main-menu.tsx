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

  if (auth.isLoading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center text-zinc-500">
        Checking sign-in...
      </div>
    );
  }
  return signedIn ? <Menu /> : <SignInScreen />;
}

// Step 0: everyone starts here. Magic-link sign-in also creates the
// account the first time, so one button covers sign in and register.
function SignInScreen() {
  const auth = useAuth();
  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center gap-8 px-4 py-10">
      <div className="space-y-2 text-center">
        <p className="font-mono text-xs tracking-[0.28em] text-amber-200/80">
          BINARY · HEX · ASCII
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          Last Bit Standing
        </h1>
      </div>
      <Panel>
        <h2 className="text-lg font-medium text-zinc-100">Sign in or register</h2>
        <p className="text-sm text-zinc-400">
          Enter your email and we will send you a magic link. New players get an
          account automatically on first sign-in.
        </p>
        <Button className="w-full" onClick={() => void auth.signinRedirect()}>
          <LogIn className="size-4" /> Continue with email
        </Button>
        {auth.error && (
          <p className="text-sm text-red-300">Sign-in problem: {auth.error.message}</p>
        )}
      </Panel>
    </div>
  );
}

function Menu() {
  const auth = useAuth();
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
          <span className="text-zinc-400">{email}</span>
          <Button size="sm" variant="ghost" onClick={() => void auth.signoutRedirect()}>
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
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
      </div>

      <Panel>
        <h2 className="text-lg font-medium text-zinc-100">Your profile</h2>
        <SpacetimeShell idToken={auth.user!.id_token}>
          <ProfileCard />
        </SpacetimeShell>
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
