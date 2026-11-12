"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
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
      className="landing-video"
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
      <source src="/media/landing-hero-portrait.mp4" type="video/mp4" media="(max-aspect-ratio: 2/3)" />
      <source src="/media/landing-hero.mp4" type="video/mp4" />
    </video>
  );
}

const TOUCH_DEVICE = "(max-width: 767px), (pointer: coarse)";

export default function LandingBackground() {
  const reduce = useLandingReducedMotion();

  // Desktops render the shader at screen resolution (sharp on Retina); phones and
  // tablets play the pre-rendered video, which their hardware decoder handles cheaply.
  // null until mounted, so neither the shader nor the video loads on the wrong device.
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

  return (
    <div className="landing-background landing-artwork" aria-hidden="true">
      {touchDevice ? <LandingVideo reduce={reduce} /> : <LandingWaylumeBackground />}
    </div>
  );
}
