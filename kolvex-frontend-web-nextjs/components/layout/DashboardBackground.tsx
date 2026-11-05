"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const WaylumeBackground = dynamic(() => import("./WaylumeBackground"), {
  ssr: false,
});

/**
 * Animated workspace backdrop. The Waylume look is a dark canvas, so it only
 * mounts in the dark theme; dark text in the light theme would be unreadable
 * on it. Loaded client-side to keep the WebGL engine out of the shared bundle.
 */
export default function DashboardBackground() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted || resolvedTheme !== "dark") return null;

  return (
    <>
      <WaylumeBackground />
      {/* Keeps data text readable where it crosses the bright core of the light. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black/70"
      />
    </>
  );
}
