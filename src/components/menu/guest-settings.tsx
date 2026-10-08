"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";
import { LogIn, LogOut } from "lucide-react";
import { useReducer, useSpacetimeDB } from "spacetimedb/react";
import { reducers } from "@/module_bindings";
import { Button } from "@/components/ui/button";
import { ProfileCard, useMe } from "@/components/menu/stats";
import {
  endGuestSession,
  newLinkCode,
  pendingLinkCode,
  setPendingLinkCode,
} from "@/lib/guest";

function message(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

// Guest settings: their ID and stats, keeping the record by linking it to an
// account, or leaving guest mode (which deletes the record).
export function GuestSettings({ onExit }: { onExit: () => void }) {
  const auth = useAuth();
  const me = useMe();
  const linkStart = useReducer(reducers.linkGuestStart);
  const discard = useReducer(reducers.discardGuest);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const keepRecord = async () => {
    setError(null);
    setBusy(true);
    try {
      const code = newLinkCode();
      await linkStart({ code });
      setPendingLinkCode(code);
      await auth.signinRedirect();
    } catch (e) {
      setError(message(e));
      setBusy(false);
    }
  };

  const leave = async () => {
    const id = me?.name ?? "your guest ID";
    const ok = window.confirm(
      `Leaving guest mode permanently deletes ${id} along with its rating, matches, wins, and accuracy. ` +
        "This cannot be undone. Register first if you want to keep them.\n\nLeave and delete anyway?",
    );
    if (!ok) return;
    setBusy(true);
    try {
      await discard();
    } catch {
      // Best effort: the local identity is forgotten either way.
    }
    endGuestSession();
    onExit();
  };

  return (
    <div className="space-y-5">
      <ProfileCard guest />

      <div className="space-y-2 rounded-lg border border-amber-300/30 bg-amber-300/5 p-4">
        <h3 className="font-medium text-zinc-100">Keep your record</h3>
        <p className="text-sm text-zinc-400">
          Your guest record lives only in this browser. Register, or sign in to an
          existing account, and your rating and stats move onto that account.
          Ranked play on the leaderboard needs an account.
        </p>
        <Button onClick={() => void keepRecord()} disabled={busy}>
          <LogIn className="size-4" /> Register or sign in to keep it
        </Button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-zinc-300">Leave guest mode</h3>
        <p className="text-sm text-zinc-500">Deletes this guest ID and everything recorded under it.</p>
        <Button variant="outline" onClick={() => void leave()} disabled={busy}>
          <LogOut className="size-4" /> Leave and delete guest data
        </Button>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}
    </div>
  );
}

// Runs once after a guest signs in: moves the guest record onto the account.
export function GuestLinkClaimer() {
  const conn = useSpacetimeDB();
  const claim = useReducer(reducers.linkGuestClaim);
  const started = useRef(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const code = pendingLinkCode();
    if (!code || started.current || !conn.isActive) return;
    started.current = true;
    claim({ code })
      .then(() => {
        endGuestSession();
        setNote({ ok: true, text: "Your guest record is now on this account." });
      })
      .catch((e: unknown) => {
        setPendingLinkCode(null);
        setNote({ ok: false, text: `Could not move your guest record: ${message(e)}` });
      });
  }, [conn.isActive, claim]);

  if (!note) return null;
  return <p className={note.ok ? "text-sm text-emerald-300" : "text-sm text-red-300"}>{note.text}</p>;
}
