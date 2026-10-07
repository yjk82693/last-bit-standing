"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { House } from "lucide-react";
import { Button } from "@/components/ui/button";

// One consistent way back to the main menu from every screen. Pass
// confirmMessage when leaving would throw away progress (a live match).
export function MainMenuButton({
  confirmMessage,
  size = "sm",
}: {
  confirmMessage?: string;
  size?: "sm" | "lg";
}) {
  const router = useRouter();
  if (confirmMessage) {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={() => {
          if (window.confirm(confirmMessage)) router.push("/");
        }}
      >
        <House className="size-4" /> Main menu
      </Button>
    );
  }
  return (
    <Button variant="outline" size={size} asChild>
      <Link href="/">
        <House className="size-4" /> Main menu
      </Link>
    </Button>
  );
}
