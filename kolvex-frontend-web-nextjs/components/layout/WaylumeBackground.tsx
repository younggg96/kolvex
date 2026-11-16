"use client";
/**
 * Dashboard backdrop in the dark theme (desktop only; see DashboardBackground).
 * A Waylume studio export: only the look lives here; the engine is shared in
 * components/backgrounds/WaylumeCanvas.tsx.
 */
import WaylumeCanvas, { type WaylumeBackgroundProps } from "@/components/backgrounds/WaylumeCanvas";

/** The look exported from the studio. */
const WAYLUME_SETTINGS = {
  aspectRatio: 1.777778,
  background: [0.0078, 0.0235, 0.0275],
  durationSeconds: 60,
  maxPixelRatio: 2,
  pace: 0.4,
  params: {
    balanceX: 0,
    balanceY: 0,
    bend: 48,
    chromaSplit: 14,
    cornerRadius: 12,
    curve: "scurve",
    curveDepth: 30,
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
    glow: 43,
    grainAmount: 50,
    grainDistortion: 50,
    grainEnabled: true,
    grainDrift: 35,
    grainScale: 70,
    grainSoftness: 50,
    height: 49,
    inset: 0,
    lens: {
      angle: 2,
      bias: 1,
      count: 35,
      dispersion: 0.5,
      dispersionColor: 0.8,
      dispersionShift: -0.6,
      enabled: true,
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
      spread: 0.6,
      swirl: 0.4,
    },
    lightTravel: 80,
    masks: [],
    masksEnabled: true,
    mode: "central",
    path: [
      -0.06, 0.45, -0.0394, 0.4811, -0.019, 0.5124, 0.0015, 0.5436, 0.0222, 0.5745, 0.0431, 0.6048,
      0.0645, 0.6341, 0.0865, 0.6618, 0.1094, 0.6873, 0.1331, 0.7103, 0.1575, 0.7307, 0.1826,
      0.7484, 0.2084, 0.7626, 0.2348, 0.7725, 0.2616, 0.7779, 0.2886, 0.7788, 0.3155, 0.7757,
      0.3422, 0.7692, 0.3687, 0.7601, 0.395, 0.7488, 0.421, 0.7358, 0.4467, 0.7214, 0.4722, 0.7056,
      0.4974, 0.6886, 0.5225, 0.6706, 0.5472, 0.6513, 0.5715, 0.6305, 0.5954, 0.6082, 0.6188,
      0.5844, 0.6419, 0.5595, 0.6647, 0.5339, 0.6874, 0.5078, 0.71, 0.4815, 0.7326, 0.4552, 0.7553,
      0.4293, 0.7782, 0.4039, 0.8013, 0.3791, 0.8246, 0.3548, 0.848, 0.3309, 0.8715, 0.3072, 0.895,
      0.2836, 0.9185, 0.2601, 0.9421, 0.2367, 0.9656, 0.2133, 0.9892, 0.19, 1.0128, 0.1667, 1.0364,
      0.1434, 1.06, 0.12,
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
    saturation: 86,
    secondaryMotion: 31,
    shading: 0,
    softness: 70,
    spectrum: "custom",
    speed: 3,
    spread: 62,
    surfaceGrain: true,
    wobble: 58,
  },
  pauseOffscreen: true,
  respectReducedMotion: true,
  startSeconds: 23.3267,
};
const WAYLUME_BACKGROUND = "rgb(2, 6, 7)";
const WAYLUME_ASPECT = 1.777778;

export default function WaylumeBackground(props: WaylumeBackgroundProps) {
  return (
    <WaylumeCanvas
      {...props}
      settings={WAYLUME_SETTINGS}
      background={WAYLUME_BACKGROUND}
      aspect={WAYLUME_ASPECT}
    />
  );
}
