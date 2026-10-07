"use client";

import dynamic from "next/dynamic";

// Reads your profile name from SpacetimeDB, which needs the browser.
const Page = dynamic(() => import("@/components/menu/solo-page").then((m) => m.SoloPage), {
  ssr: false,
});

export default function RoutePage() {
  return <Page />;
}
