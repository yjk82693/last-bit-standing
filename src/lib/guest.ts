import { useState } from "react";
import { forgetGuestToken } from "@/lib/spacetime-client";

// Guest mode lives in this browser only: a flag, the SpacetimeDB guest token
// (kept by spacetime-client), and, while linking, a one-time code that moves
// the guest record onto an account after sign-in.
const GUEST_KEY = "lbs-guest";
const LINK_KEY = "lbs-guest-link";

function get(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function put(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {}
}

export function isGuest(): boolean {
  return get(GUEST_KEY) === "1";
}

export function useGuestMode(): [boolean, (on: boolean) => void] {
  const [guest, setState] = useState(isGuest);
  const setGuest = (on: boolean) => {
    put(GUEST_KEY, on ? "1" : null);
    setState(on);
  };
  return [guest, setGuest];
}

export function pendingLinkCode(): string | null {
  return get(LINK_KEY);
}

export function setPendingLinkCode(code: string | null) {
  put(LINK_KEY, code);
}

export function newLinkCode(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Forget everything about the guest in this browser.
export function endGuestSession() {
  put(GUEST_KEY, null);
  put(LINK_KEY, null);
  forgetGuestToken();
}
