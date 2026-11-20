"use client";
/**
 * Dashboard backdrop in the dark theme when the 黑白 (mono) palette is active, including when
 * "follow the market" turns the page mono outside trading hours. Desktop only; see
 * DashboardBackground. A Wayglim studio export (mono spectrum, path form, pointer-follow):
 * only the look lives here; the engine is shared in components/backgrounds/WaylumeCanvas.tsx.
 */
import WaylumeCanvas, { type WaylumeBackgroundProps } from "@/components/backgrounds/WaylumeCanvas";

/** The look exported from the studio. */
const WAYLUME_MONO_SETTINGS = {
  aspectRatio: 1.777778,
  background: [0.0196, 0.0157, 0.0392],
  durationSeconds: 60,
  maxPixelRatio: 2,
  pace: 0.5,
  params: {
    balanceX: 0,
    balanceY: 0,
    bend: 48,
    chromaSplit: 14,
    cornerRadius: 12,
    curve: "line",
    curveDepth: 0,
    customColors: [
      [0.7882, 0.7216, 1],
      [0.8784, 0.902, 1],
      [0.5608, 0.498, 0.9098],
      [0.7882, 0.7216, 1],
    ],
    effectArea: "core",
    form: "path",
    formRotate: 0,
    formRound: 35,
    formSize: 50,
    formSpin: 0,
    frameShape: "rect",
    glow: 36,
    grainAmount: 36,
    grainDistortion: 50,
    grainEnabled: true,
    grainDrift: 35,
    grainScale: 86,
    grainSoftness: 12,
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
    mode: "edge",
    path: [
      0.06, 1.06, 0.0612, 1.0076, 0.0625, 0.9552, 0.0653, 0.903, 0.0714, 0.8517, 0.0834, 0.804,
      0.1026, 0.7643, 0.1272, 0.7357, 0.1548, 0.7174, 0.1836, 0.706, 0.2128, 0.6989, 0.2422, 0.695,
      0.2717, 0.6933, 0.3012, 0.6931, 0.3307, 0.6937, 0.3602, 0.6948, 0.3897, 0.6961, 0.4192,
      0.6975, 0.4487, 0.6987, 0.4782, 0.6996, 0.5077, 0.7002, 0.5372, 0.701, 0.5667, 0.7023, 0.5962,
      0.7039, 0.6257, 0.7055, 0.6552, 0.707, 0.6847, 0.7081, 0.7142, 0.7083, 0.7437, 0.7072, 0.7732,
      0.7039, 0.8024, 0.6973, 0.8312, 0.6861, 0.859, 0.6684, 0.8844, 0.6419, 0.9059, 0.6061, 0.9223,
      0.5627, 0.9335, 0.5142, 0.9401, 0.4631, 0.9441, 0.4111, 0.947, 0.3589, 0.9496, 0.3067, 0.9521,
      0.2544, 0.9541, 0.2021, 0.9557, 0.1497, 0.9569, 0.0973, 0.958, 0.0449, 0.959, -0.0076, 0.96,
      -0.06,
    ],
    phase: 31,
    pointer: {
      color: 35,
      enabled: true,
      glow: 25,
      grain: 100,
      pull: 25,
      reach: 40,
      smoothing: 85,
    },
    position: 50,
    refraction: 49,
    saturation: 76,
    secondaryMotion: 38,
    shading: 0,
    softness: 70,
    spectrum: "mono",
    speed: 3,
    spread: 62,
    surfaceGrain: true,
    wobble: 42,
  },
  pauseOffscreen: true,
  respectReducedMotion: true,
  startSeconds: 12.8318,
};
const WAYLUME_MONO_BACKGROUND = "rgb(5, 4, 10)";
const WAYLUME_MONO_ASPECT = 1.777778;

export default function WaylumeMonoBackground(props: WaylumeBackgroundProps) {
  return (
    <WaylumeCanvas
      {...props}
      settings={WAYLUME_MONO_SETTINGS}
      background={WAYLUME_MONO_BACKGROUND}
      aspect={WAYLUME_MONO_ASPECT}
    />
  );
}
