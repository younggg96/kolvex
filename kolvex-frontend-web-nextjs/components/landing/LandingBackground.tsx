"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { PALETTE_ATTRIBUTE } from "@/lib/themePalettes";
import LandingWaylumeBackground from "./LandingWaylumeBackground";
import { useLandingReducedMotion } from "./useLandingReducedMotion";

/** Pre-rendered Waylume loop: hardware video decode instead of a per-pixel shader. */
function LandingVideo({ reduce }: { reduce: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (reduce) element.pause();
    else element.play().catch(() => {}); // Autoplay can be refused (e.g. Low Power Mode); the poster stays.
  }, [reduce]);

  return (
    <video
      ref={video}
      className="absolute inset-0 h-full w-full bg-[rgb(3_8_5)] object-cover"
      autoPlay={!reduce}
      muted
      loop
      playsInline
      preload={reduce ? "none" : "auto"}
      poster="/media/landing-hero-poster.jpg"
      disablePictureInPicture
      tabIndex={-1}
    >
      {/* Portrait screens only show the centre strip, so they get a full-resolution crop of it. */}
      <source
        src="/media/landing-hero-portrait.mp4"
        type="video/mp4"
        media="(max-aspect-ratio: 2/3)"
      />
      <source src="/media/landing-hero.mp4" type="video/mp4" />
    </video>
  );
}

const TOUCH_DEVICE = "(max-width: 767px), (pointer: coarse)";

function subscribeToDarkPalette(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [PALETTE_ATTRIBUTE.dark],
  });
  return () => observer.disconnect();
}

function isMonoPalette() {
  return document.documentElement.getAttribute(PALETTE_ATTRIBUTE.dark) === "mono";
}

export default function LandingBackground() {
  const reduce = useLandingReducedMotion();
  const mono = useSyncExternalStore(subscribeToDarkPalette, isMonoPalette, () => false);

  // Touch and narrow screens use prerendered media. Wait for the device check
  // before loading either the media or the live shader.
  const [touchDevice, setTouchDevice] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia(TOUCH_DEVICE);
    const update = () => setTouchDevice(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const { resolvedTheme } = useTheme();
  if (touchDevice === null || resolvedTheme !== "dark") return null;

  if (mono) {
    return (
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-[rgb(var(--landing-mono-backdrop))] contrast-more:hidden [@media(prefers-reduced-transparency:reduce)]:hidden"
        aria-hidden="true"
      >
        {touchDevice ? (
          <div className="absolute inset-0 bg-[url('/media/landing-mono-still.webp')] bg-cover bg-center" />
        ) : (
          <LandingWaylumeBackground mono />
        )}
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 hidden dark:block dark:bg-[rgb(3_8_5)]"
      aria-hidden="true"
    >
      {touchDevice ? <LandingVideo reduce={reduce} /> : <LandingWaylumeBackground mono={false} />}
    </div>
  );
}
