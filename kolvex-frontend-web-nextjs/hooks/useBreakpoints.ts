"use client";

import { useState, useEffect } from "react";
/**
 * Custom hook to get the current window width
 * @returns current window width in pixels
 */
function useWindowWidth(): number {
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 0
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleResize = () => {
      setWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
