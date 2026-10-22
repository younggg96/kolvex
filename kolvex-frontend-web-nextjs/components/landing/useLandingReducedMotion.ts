"use client";

import { useSyncExternalStore } from "react";

const motionPreference = "(prefers-reduced-motion: reduce)";
function subscribeToMotionPreference(callback: () => void) {
  const query = window.matchMedia(motionPreference);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
// The server snapshot keeps the heading and control identical during hydration.
export function useLandingReducedMotion() {
  return useSyncExternalStore(subscribeToMotionPreference,
    () => window.matchMedia(motionPreference).matches, () => false);
}

