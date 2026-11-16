"use client";
/**
 * Home page hero backdrop (see LandingBackground).
 * A Waylume studio export: only the look lives here; the engine is shared in
 * components/backgrounds/WaylumeCanvas.tsx.
 */
import WaylumeCanvas, { type WaylumeBackgroundProps } from "@/components/backgrounds/WaylumeCanvas";

/** The look exported from the studio. */
const WAYLUME_SETTINGS = {
  aspectRatio: 1.777778,
  background: [0.0118, 0.0314, 0.0196],
  durationSeconds: 60,
  maxPixelRatio: 2,
  pace: 0.35,
  params: {
    balanceX: 0,
    balanceY: 0,
    bend: 48,
    chromaSplit: 14,
    cornerRadius: 12,
    curve: "line",
    curveDepth: 0,
    customColors: [
      [0.1176, 0.851, 0.5412],
      [0.7216, 0.9412, 0.3529],
      [0.0588, 0.6392, 0.6392],
      [0.3608, 1, 0.6157],
    ],
    effectArea: "core",
    form: "path",
    formRotate: 0,
    formRound: 35,
    formSize: 50,
    formSpin: 0,
    frameShape: "rect",
    glow: 40,
    grainAmount: 38,
    grainDistortion: 50,
    grainEnabled: true,
    grainDrift: 35,
    grainScale: 70,
    grainSoftness: 35,
    height: 58,
    inset: 0,
    lens: {
      angle: 2,
      bias: 1,
      count: 35,
      dispersion: 0,
      dispersionColor: 0.46,
      dispersionShift: 0.11,
      enabled: false,
      focusCenter: 0.8,
      focusEdges: 1,
      grainMixer: 0,
      grainOverlay: 0,
      imageX: 0,
      imageY: 0,
      lensBulge: 0,
      lensCircle: 0,
      noise: 0,
      noiseFrequency: 0.25,
      noiseOffset: 0,
      perspective: 0.1,
      spread: 0.97,
      swirl: -0.14,
    },
    lightTravel: 80,
    masks: [],
    masksEnabled: true,
    mode: "halo",
    path: [
      1.06, 0.42, 1.0394, 0.4383, 1.0189, 0.4566, 0.9984, 0.475, 0.978, 0.4937, 0.9577, 0.5129,
      0.9376, 0.5329, 0.918, 0.5541, 0.8989, 0.5768, 0.8803, 0.6009, 0.8621, 0.6257, 0.8437, 0.6502,
      0.8249, 0.6736, 0.8053, 0.6949, 0.7848, 0.7135, 0.7636, 0.7293, 0.7419, 0.7427, 0.7199,
      0.7542, 0.6975, 0.7638, 0.6749, 0.7714, 0.6522, 0.7766, 0.6292, 0.779, 0.6063, 0.7778, 0.5835,
      0.7727, 0.5611, 0.7636, 0.5393, 0.7507, 0.5183, 0.7341, 0.4984, 0.7136, 0.4801, 0.689, 0.464,
      0.6599, 0.451, 0.6263, 0.4412, 0.5894, 0.4342, 0.5505, 0.4292, 0.5106, 0.4255, 0.4703, 0.4224,
      0.4298, 0.42, 0.3892, 0.4184, 0.3485, 0.4177, 0.3076, 0.4179, 0.2668, 0.4186, 0.2259, 0.4193,
      0.1851, 0.4198, 0.1443, 0.4199, 0.1034, 0.42, 0.0626, 0.42, 0.0217, 0.42, -0.0191, 0.42,
      -0.06,
    ],
    phase: 31,
    pointer: {
      color: 35,
      enabled: false,
      glow: 25,
      grain: 50,
      pull: 40,
      reach: 35,
      smoothing: 45,
    },
    position: 50,
    refraction: 49,
    saturation: 61,
    secondaryMotion: 38,
    shading: 0,
    softness: 78,
    spectrum: "custom",
    speed: 3,
    spread: 62,
    surfaceGrain: true,
    wobble: 42,
  },
  pauseOffscreen: true,
  respectReducedMotion: true,
  startSeconds: 14.7026,
};
const WAYLUME_BACKGROUND = "rgb(3, 8, 5)";
const WAYLUME_ASPECT = 1.777778;

export default function LandingWaylumeBackground(props: WaylumeBackgroundProps) {
  return (
    <WaylumeCanvas
      {...props}
      settings={WAYLUME_SETTINGS}
      background={WAYLUME_BACKGROUND}
      aspect={WAYLUME_ASPECT}
    />
  );
}
