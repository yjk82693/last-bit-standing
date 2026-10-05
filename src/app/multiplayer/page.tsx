"use client";

import dynamic from "next/dynamic";

// The SpacetimeDB client needs the browser (WebSocket + localStorage), so skip SSR.
const MultiplayerApp = dynamic(
  () => import("@/components/multiplayer/multiplayer-app").then((m) => m.MultiplayerApp),
  { ssr: false },
);

export default function MultiplayerPage() {
  return <MultiplayerApp />;
}
