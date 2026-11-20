"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";

import { PALETTE_ATTRIBUTE } from "@/lib/themePalettes";

const WaylumeBackground = dynamic(() => import("./WaylumeBackground"), {
  ssr: false,
});
const WaylumeMonoBackground = dynamic(() => import("./WaylumeMonoBackground"), {
  ssr: false,
});

/** Matches the shell's mobile layout (sidebar collapses below 1024px). */
const MOBILE_QUERY = "(max-width: 1023px)";

/**
 * Workspace backdrop. The Waylume look is a dark canvas, so it only mounts in
 * the dark theme; dark text in the light theme would be unreadable on it.
 * Desktop gets the live WebGL animation (loaded client-side to keep it out of
 * the shared bundle); mobile gets a still frame of it to save GPU and battery.
 * With the 黑白 dark palette (chosen, or set by "follow the market" outside
 * trading hours) desktop shows its own mono Wayglim scene instead.
 */
export default function DashboardBackground() {
  const { resolvedTheme } = useTheme();
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [darkPalette, setDarkPalette] = useState<string | null>(null);

  // The palette is an attribute on <html> that settings and the market sync change at any time.
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setDarkPalette(root.getAttribute(PALETTE_ATTRIBUTE.dark));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: [PALETTE_ATTRIBUTE.dark] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (isMobile === null || resolvedTheme !== "dark") return null;
  const monoArt = !isMobile && darkPalette === "mono";

  return (
    <>
      {/* The art is green; dark palettes turn its hue in app/globals.css. */}
      <div
        aria-hidden="true"
        data-art={monoArt ? "mono" : undefined}
        className="dashboard-backdrop-art pointer-events-none absolute inset-0"
      >
        {isMobile ? (
          <div className="absolute inset-0 bg-[rgb(2,6,7)] bg-[url('/media/dashboard-backdrop.webp')] bg-cover bg-center" />
        ) : monoArt ? (
          <WaylumeMonoBackground />
        ) : (
          <WaylumeBackground />
        )}
      </div>
      {/* Keeps data text readable where it crosses the bright core of the light. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/70" />
    </>
  );
}
