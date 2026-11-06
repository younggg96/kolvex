"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import Waves from "./react-bits/Waves";
import LandingWaylumeBackground from "./LandingWaylumeBackground";
import { useLandingReducedMotion } from "./useLandingReducedMotion";

export default function LandingBackground() {
  const reduce = useLandingReducedMotion();

  // Phones get one still frame: the per-pixel shader at 60fps heats them up.
  const [freezeArtwork, setFreezeArtwork] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const update = () => setFreezeArtwork(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // The artwork is near-black, so it only plays in the dark theme; the light
  // theme keeps the Waves field. Until the theme is known it matches the dark default.
  const { resolvedTheme } = useTheme();
  if (resolvedTheme !== "light") {
    return (
      <div className="landing-background" aria-hidden="true">
        <LandingWaylumeBackground paused={freezeArtwork} />
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
