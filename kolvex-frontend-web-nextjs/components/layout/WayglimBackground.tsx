"use client";
/**
 * Site backdrop in the light theme (see SiteBackground).
 * A Waylume studio export: only the look lives here; the engine is shared in
 * components/backgrounds/WaylumeCanvas.tsx.
 */
import WaylumeCanvas, { type WaylumeBackgroundProps } from "@/components/backgrounds/WaylumeCanvas";

/** The look exported from the studio. */
const WAYGLIM_SETTINGS = {
  aspectRatio: 1.777778,
  background: [1, 1, 1],
  durationSeconds: 60,
  maxPixelRatio: 2,
  pace: 0.25,
  params: {
    balanceX: 0,
    balanceY: 0,
    bend: 48,
    chromaSplit: 14,
    cornerRadius: 12,
    curve: "valley",
    curveDepth: 16,
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
    glow: 29,
    grainAmount: 32,
    grainDistortion: 50,
    grainEnabled: true,
    grainDrift: 35,
    grainScale: 86,
    grainSoftness: 15,
    height: 50,
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
    mode: "central",
    path: [
      0.06, -0.06, 0.0612, -0.0076, 0.0625, 0.0448, 0.0653, 0.097, 0.0714, 0.1483, 0.0834, 0.196,
      0.1026, 0.2357, 0.1272, 0.2643, 0.1548, 0.2826, 0.1836, 0.294, 0.2128, 0.3011, 0.2422, 0.305,
      0.2717, 0.3067, 0.3012, 0.3069, 0.3307, 0.3063, 0.3602, 0.3052, 0.3897, 0.3039, 0.4192,
      0.3025, 0.4487, 0.3013, 0.4782, 0.3004, 0.5077, 0.2998, 0.5372, 0.299, 0.5667, 0.2977, 0.5962,
      0.2961, 0.6257, 0.2945, 0.6552, 0.293, 0.6847, 0.2919, 0.7142, 0.2917, 0.7437, 0.2928, 0.7732,
      0.2961, 0.8024, 0.3027, 0.8312, 0.3139, 0.859, 0.3316, 0.8844, 0.3581, 0.9059, 0.3939, 0.9223,
      0.4373, 0.9335, 0.4858, 0.9401, 0.5369, 0.9441, 0.5889, 0.947, 0.6411, 0.9496, 0.6933, 0.9521,
      0.7456, 0.9541, 0.7979, 0.9557, 0.8503, 0.9569, 0.9027, 0.958, 0.9551, 0.959, 1.0076, 0.96,
      1.06,
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
    position: 58,
    refraction: 49,
    saturation: 63,
    secondaryMotion: 38,
    shading: 0,
    softness: 84,
    spectrum: "custom",
    speed: 3,
    spread: 62,
    surfaceGrain: true,
    wobble: 30,
  },
  pauseOffscreen: true,
  respectReducedMotion: true,
  startSeconds: 14.9494,
};
const WAYGLIM_BACKGROUND = "rgb(255, 255, 255)";
const WAYGLIM_ASPECT = 1.777778;

export default function WayglimBackground(props: WaylumeBackgroundProps) {
  return (
    <WaylumeCanvas
      {...props}
      settings={WAYGLIM_SETTINGS}
      background={WAYGLIM_BACKGROUND}
      aspect={WAYGLIM_ASPECT}
    />
  );
}
