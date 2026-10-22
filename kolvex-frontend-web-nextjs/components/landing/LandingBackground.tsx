"use client";

import Waves from "./react-bits/Waves";
import { useLandingReducedMotion } from "./useLandingReducedMotion";

export default function LandingBackground() {
  const reduce = useLandingReducedMotion();
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
