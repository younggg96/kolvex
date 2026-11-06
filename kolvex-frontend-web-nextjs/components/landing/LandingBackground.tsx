"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import Waves from "./react-bits/Waves";
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

  // The artwork is near-black, so it only shows in the dark theme; the light
  // theme keeps the Waves field. Until the theme is known it matches the dark default.
  const { resolvedTheme } = useTheme();
  if (resolvedTheme !== "light") {
    return (
      <div className="landing-background landing-artwork" aria-hidden="true">
        {touchDevice === true && <LandingVideo reduce={reduce} />}
        {touchDevice === false && <LandingWaylumeBackground />}
      </div>
    );
  }

  return (
    <div className="landing-background" aria-hidden="true">
      <div className="hero-signal-field">
        <Waves
          lineColor="#00a904" accentColor="#00c805" spacing={9} lineWidth={1}
          rotation={-38} amplitude={85} scale={0.7} twist={1.5} speed={0.55}
          mouseRadius={160} mouseStrength={1.8} fade={0.12} opacity={0.55}
          paused={reduce} mouseInteraction={!reduce} clickRipple={!reduce} dpr={1.5}
        />
      </div>
    </div>
  );
}
