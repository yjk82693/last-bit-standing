"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "react-oidc-context";
import { useReducer, useSpacetimeDB, useTable } from "spacetimedb/react";
import type { Identity } from "spacetimedb";
import { Crown, LogOut, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { reducers, tables } from "@/module_bindings";
import type { Player, Room, Seat } from "@/module_bindings/types";
import { SPACETIME_URI } from "@/lib/spacetime-client";
import { AuthShell } from "@/components/auth/auth-shell";
import { SpacetimeShell } from "@/components/auth/spacetime-shell";

const QUICK_SIZES = [2, 3, 4] as const;

export function MultiplayerApp() {
  return (
    <AuthShell>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10">
        <SignedInGate />
      </div>
    </AuthShell>
  );
}

// Multiplayer needs an email account, so the connection uses the sign-in token.
function SignedInGate() {
  const auth = useAuth();
  if (auth.isLoading) {
    return <Panel><p className="text-zinc-400">Checking sign-in...</p></Panel>;
  }
  if (!auth.isAuthenticated || !auth.user?.id_token) {
    return (
      <Panel>
        <h2 className="text-lg font-medium text-zinc-100">Sign in to play multiplayer</h2>
        <p className="text-sm text-zinc-400">
          Your email account keeps your rating and stats on every device.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => void auth.signinRedirect()}>Sign in with email</Button>
          <Link href="/" className="self-center text-sm text-zinc-400 underline-offset-4 hover:underline">
            Main menu
          </Link>
        </div>
      </Panel>
    );
  }
  return (
    <SpacetimeShell idToken={auth.user.id_token}>
      <Shell />
    </SpacetimeShell>
  );
}

function sameId(a?: Identity, b?: Identity) {
  return Boolean(a && b && a.isEqual(b));
}

// Turns a reducer error into a message instead of an unhandled rejection.
function useAction() {
  const [error, setError] = useState<string | null>(null);
  const run = (p: Promise<void>) => {
    setError(null);
    p.catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };
  return { error, run };
}

function Shell() {
  const conn = useSpacetimeDB();
  const [players] = useTable(tables.player);
  const [rooms, roomsReady] = useTable(tables.room);
  const [seats] = useTable(tables.seat);

  if (conn.connectionError) {
    return (
      <Panel>
        <p className="text-red-300">Could not reach SpacetimeDB at {SPACETIME_URI}.</p>
        <p className="text-sm text-zinc-400">
          Is <code className="font-mono">spacetime start</code> running?
        </p>
      </Panel>
    );
  }
  if (!conn.isActive || !conn.identity || !roomsReady) {
    return <Panel><p className="text-zinc-400">Connecting to the table...</p></Panel>;
  }

  const me = conn.identity;
  const myPlayer = players.find((p) => sameId(p.identity, me));
  const mySeat = seats.find((s) => {
    if (!sameId(s.identity, me)) return false;
    const r = rooms.find((x) => x.id === s.roomId);
    return r && r.phase !== "finished";
  });
  const myRoom = mySeat ? rooms.find((r) => r.id === mySeat.roomId) : undefined;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs tracking-[0.28em] text-amber-200/80">MULTIPLAYER</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            Last Bit Standing
          </h1>
        </div>
        <Link href="/" className="text-sm text-zinc-400 underline-offset-4 hover:underline">
          Main menu
        </Link>
      </header>

      <NameBar player={myPlayer} />

      {myRoom && mySeat ? (
        <WaitingRoom room={myRoom} seats={seats} players={players} me={me} />
      ) : (
        <Lobby rooms={rooms} seats={seats} />
      )}
    </>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      {children}
    </section>
  );
}

function NameBar({ player }: { player?: Player }) {
  const setName = useReducer(reducers.setName);
  const [draft, setDraft] = useState<string | null>(null);
  const { error, run } = useAction();
  const value = draft ?? player?.name ?? "";

  return (
    <Panel>
      <label className="text-sm text-zinc-400" htmlFor="mp-name">Your name</label>
      <div className="flex gap-2">
        <Input
          id="mp-name"
          value={value}
          maxLength={24}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          disabled={!draft || draft === player?.name}
          onClick={() => {
            run(setName({ name: value }));
            setDraft(null);
          }}
        >
          Save
        </Button>
      </div>
      {error && <p className="text-sm text-red-300">{error}</p>}
    </Panel>
  );
}

function Lobby({ rooms, seats }: { rooms: readonly Room[]; seats: readonly Seat[] }) {
  const quickMatch = useReducer(reducers.quickMatch);
  const createCustom = useReducer(reducers.createCustomRoom);
  const joinRoom = useReducer(reducers.joinRoom);
  const joinByCode = useReducer(reducers.joinByCode);
  const { error, run } = useAction();

  const [customName, setCustomName] = useState("");
  const [customSize, setCustomSize] = useState(4);
  const [customPrivate, setCustomPrivate] = useState(false);
  const [code, setCode] = useState("");

  const countIn = (id: bigint) => seats.filter((s) => s.roomId === id).length;
  const openRooms = rooms
    .filter((r) => r.visibility === "public" && r.phase === "waiting")
    .sort((a, b) => Number(b.createdAt.microsSinceUnixEpoch - a.createdAt.microsSinceUnixEpoch));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Panel>
        <h2 className="text-lg font-medium text-zinc-100">Quick match</h2>
        <p className="text-sm text-zinc-400">Jump into the next open table of that size.</p>
        <div className="flex gap-2">
          {QUICK_SIZES.map((n) => (
            <Button key={n} variant="secondary" onClick={() => run(quickMatch({ size: n }))}>
              {n} players
            </Button>
          ))}
        </div>
      </Panel>

      <Panel>
        <h2 className="text-lg font-medium text-zinc-100">Join by code</h2>
        <div className="flex gap-2">
          <Input
            value={code}
            maxLength={5}
            placeholder="ABCDE"
            className="font-mono uppercase tracking-widest"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <Button disabled={code.length !== 5} onClick={() => run(joinByCode({ code }))}>
            Join
          </Button>
        </div>
      </Panel>

      <Panel>
        <h2 className="text-lg font-medium text-zinc-100">Custom room</h2>
        <Input
          value={customName}
          maxLength={32}
          placeholder="Table name"
          onChange={(e) => setCustomName(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-400">Seats</span>
          {[2, 3, 4, 5, 6].map((n) => (
            <Button
              key={n}
              size="sm"
              variant={customSize === n ? "default" : "outline"}
              onClick={() => setCustomSize(n)}
            >
              {n}
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={customPrivate}
            onChange={(e) => setCustomPrivate(e.target.checked)}
          />
          Private (code only)
        </label>
        <Button
          onClick={() =>
            run(createCustom({ name: customName, capacity: customSize, isPrivate: customPrivate }))
          }
        >
          Create room
        </Button>
      </Panel>

      <Panel>
        <h2 className="text-lg font-medium text-zinc-100">Open tables</h2>
        {openRooms.length === 0 ? (
          <p className="text-sm text-zinc-400">No public tables right now. Start one.</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {openRooms.map((r) => {
              const n = countIn(r.id);
              const full = n >= r.capacity;
              return (
                <li key={r.id.toString()} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-zinc-100">{r.name}</p>
                    <p className="text-xs text-zinc-500">
                      {r.kind === "quick" ? "Quick" : "Custom"} · {n}/{r.capacity}
                    </p>
                  </div>
                  <Button size="sm" disabled={full} onClick={() => run(joinRoom({ roomId: r.id }))}>
                    {full ? "Full" : "Join"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {error && <p className="text-sm text-red-300 md:col-span-2">{error}</p>}
    </div>
  );
}

function WaitingRoom({
  room,
  seats,
  players,
  me,
}: {
  room: Room;
  seats: readonly Seat[];
  players: readonly Player[];
  me: Identity;
}) {
  const setReady = useReducer(reducers.setReady);
  const leave = useReducer(reducers.leaveRoom);
  const start = useReducer(reducers.startMatch);
  const kick = useReducer(reducers.kick);
  const setCapacity = useReducer(reducers.setCapacity);
  const { error, run } = useAction();

  const roomSeats = seats
    .filter((s) => s.roomId === room.id)
    .sort((a, b) => a.seatIndex - b.seatIndex);
  const mine = roomSeats.find((s) => sameId(s.identity, me));
  const isHost = sameId(room.host, me);
  const isCustom = room.kind === "custom";
  const allReady = roomSeats.length >= 2 && roomSeats.every((s) => s.ready);
  const canStart =
    allReady && (isCustom ? isHost : roomSeats.length === room.capacity);
  const nameOf = (id: Identity) =>
    players.find((p) => sameId(p.identity, id))?.name ?? "Player";
  const onlineOf = (id: Identity) =>
    players.find((p) => sameId(p.identity, id))?.online ?? false;

  if (room.phase === "playing") {
    return (
      <Panel>
        <h2 className="text-lg font-medium text-zinc-100">{room.name}</h2>
        <p className="text-zinc-300">Match started. The table itself comes in the next step.</p>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-zinc-100">{room.name}</h2>
          <p className="text-xs text-zinc-500">
            {isCustom ? "Custom" : "Quick"} · {room.visibility} · {roomSeats.length}/{room.capacity}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Room code</p>
          <p className="font-mono text-2xl tracking-[0.3em] text-amber-200">{room.code}</p>
        </div>
      </div>

      <ul className="divide-y divide-zinc-800">
        {roomSeats.map((s) => (
          <li key={s.id.toString()} className="flex items-center justify-between gap-3 py-2">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-zinc-500" />
              <span className="text-zinc-100">{nameOf(s.identity)}</span>
              {sameId(s.identity, room.host) && <Crown className="size-4 text-amber-300" />}
              {sameId(s.identity, me) && <Badge variant="secondary">you</Badge>}
              {!onlineOf(s.identity) && <Badge variant="outline">offline</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={s.ready ? "default" : "outline"}>{s.ready ? "Ready" : "Not ready"}</Badge>
              {isCustom && isHost && !sameId(s.identity, me) && (
                <Button size="sm" variant="ghost" onClick={() => run(kick({ seatId: s.id }))}>
                  Remove
                </Button>
              )}
            </div>
          </li>
        ))}
        {Array.from({ length: Math.max(0, room.capacity - roomSeats.length) }).map((_, i) => (
          <li key={`empty-${i}`} className="py-2 text-sm text-zinc-600">Open seat</li>
        ))}
      </ul>

      {isCustom && isHost && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-zinc-400">Seats</span>
          {[2, 3, 4, 5, 6].map((n) => (
            <Button
              key={n}
              size="sm"
              variant={room.capacity === n ? "default" : "outline"}
              disabled={n < roomSeats.length}
              onClick={() => run(setCapacity({ capacity: n }))}
            >
              {n}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant={mine?.ready ? "secondary" : "default"}
          onClick={() => run(setReady({ ready: !mine?.ready }))}
        >
          {mine?.ready ? "Unready" : "Ready"}
        </Button>
        <Button disabled={!canStart} onClick={() => run(start())}>
          Start match
        </Button>
        <Button variant="ghost" onClick={() => run(leave())}>
          <LogOut className="size-4" /> Leave
        </Button>
      </div>
      {!canStart && (
        <p className="text-xs text-zinc-500">
          {isCustom
            ? isHost
              ? "Start unlocks when at least 2 players are seated and everyone is ready."
              : "Waiting for the host to start."
            : "Starts when the table is full and everyone is ready."}
        </p>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
    </Panel>
  );
}
