"use client";

import { useSyncExternalStore } from "react";

/**
 * Custom hook to get the current window width
 * Uses a default desktop width to prevent hydration mismatches
 * @returns current window width in pixels
 */
function subscribe(callback: () => void) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

function getSnapshot() {
  return window.innerWidth;
}

function getServerSnapshot() {
  // Server-side default - will be replaced immediately on client
  return 1280;
}

function useWindowWidth(): number {
  // useSyncExternalStore ensures we get the correct value on first client render
  // This avoids the flash of wrong layout that useState + useEffect causes
  const width = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return width;
}

/**
 * Breakpoint presets for different device sizes
 */
export const Breakpoints = {
  mobile: 640, // Tailwind's sm
  tablet: 768, // Tailwind's md
  laptop: 1024, // Tailwind's lg
  desktop: 1280, // Tailwind's xl
  wide: 1536, // Tailwind's 2xl
} as const;

/**
 * Custom hook to check multiple breakpoints
 * @returns object with boolean values for each breakpoint
 */
export function useBreakpoints() {
  const width = useWindowWidth();

  return {
    isMobile: width < Breakpoints.tablet,
    isTablet: width >= Breakpoints.tablet && width < Breakpoints.laptop,
    isLaptop: width >= Breakpoints.laptop && width < Breakpoints.desktop,
    isDesktop: width >= Breakpoints.desktop && width < Breakpoints.wide,
    isWide: width >= Breakpoints.wide,
    width,
  };
}
