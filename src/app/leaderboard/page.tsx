"use client";

import dynamic from "next/dynamic";

// Auth and the SpacetimeDB client need the browser, so skip SSR.
const Page = dynamic(() => import("@/components/menu/leaderboard-page").then((m) => m.LeaderboardPage), { ssr: false });

export default function RoutePage() {
  return <Page />;
}
