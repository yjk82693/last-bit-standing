"use client";

import dynamic from "next/dynamic";

// Auth and the SpacetimeDB client need the browser, so skip SSR.
const MainMenuPage = dynamic(
  () => import("@/components/menu/main-menu").then((m) => m.MainMenuPage),
  { ssr: false },
);

export default function Home() {
  return <MainMenuPage />;
}
