"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

const WaylumeBackground = dynamic(() => import("./WaylumeBackground"), {
  ssr: false,
});

/** Matches the shell's mobile layout (sidebar collapses below 1024px). */
const MOBILE_QUERY = "(max-width: 1023px)";

/**
 * Workspace backdrop. The Waylume look is a dark canvas, so it only mounts in
 * the dark theme; dark text in the light theme would be unreadable on it.
 * Desktop gets the live WebGL animation (loaded client-side to keep it out of
 * the shared bundle); mobile gets a still frame of it to save GPU and battery.
 */
export default function DashboardBackground() {
  const { resolvedTheme } = useTheme();
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (isMobile === null || resolvedTheme !== "dark") return null;

  return (
    <>
      {isMobile ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[rgb(2,6,7)] bg-[url('/media/dashboard-backdrop.webp')] bg-cover bg-center"
        />
      ) : (
        <WaylumeBackground />
      )}
      {/* Keeps data text readable where it crosses the bright core of the light. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-black/70"
      />
    </>
  );
}
