"use client";
/**
 * Auth pages backdrop (sign-in, sign-up, password reset).
 * A Waylume studio export: only the look lives here; the engine is shared in
 * components/backgrounds/WaylumeCanvas.tsx.
 */
import WaylumeCanvas, { type WaylumeBackgroundProps } from "@/components/backgrounds/WaylumeCanvas";

/** The look exported from the studio. */
const WAYLUME_SETTINGS = {
  aspectRatio: 1.777778,
  background: [0, 0, 0],
  durationSeconds: 60,
  maxPixelRatio: 1,
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
    glow: 35,
    grainAmount: 40,
    grainDistortion: 50,
    grainEnabled: true,
    grainDrift: 35,
    grainScale: 70,
    grainSoftness: 40,
    height: 50,
    inset: 30,
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
    masks: [
      {
        blur: 60,
        centerX: 0,
        centerY: 0,
        height: 80,
        rotation: 0,
        width: 120,
      },
    ],
    masksEnabled: false,
    mode: "edge",
    path: [
      0.64, -0.06, 0.626, -0.0443, 0.612, -0.0286, 0.598, -0.0129, 0.584, 0.0027, 0.5701, 0.0186,
      0.5562, 0.0347, 0.5425, 0.0512, 0.5291, 0.0683, 0.5159, 0.0861, 0.5031, 0.1047, 0.4908,
      0.1245, 0.4791, 0.1453, 0.4681, 0.1673, 0.4578, 0.1902, 0.4481, 0.2141, 0.4391, 0.2387,
      0.4307, 0.2641, 0.4231, 0.2903, 0.4163, 0.3171, 0.4104, 0.3446, 0.4056, 0.3727, 0.4019,
      0.4013, 0.3995, 0.4304, 0.3985, 0.4598, 0.3987, 0.4892, 0.4002, 0.5185, 0.4027, 0.5476,
      0.4062, 0.5763, 0.4105, 0.6047, 0.4157, 0.6326, 0.4219, 0.6599, 0.4291, 0.6864, 0.4374,
      0.7118, 0.4466, 0.7363, 0.4565, 0.7599, 0.4667, 0.7831, 0.4769, 0.8062, 0.4868, 0.8297,
      0.4963, 0.8538, 0.5053, 0.8785, 0.5138, 0.9038, 0.5219, 0.9295, 0.5297, 0.9554, 0.5374,
      0.9814, 0.545, 1.0076, 0.5525, 1.0338, 0.56, 1.06,
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
    saturation: 69,
    secondaryMotion: 38,
    shading: 0,
    softness: 70,
    spectrum: "custom",
    speed: 3,
    spread: 62,
    surfaceGrain: true,
    wobble: 42,
  },
  pauseOffscreen: true,
  respectReducedMotion: true,
  startSeconds: 27.9308,
};
const WAYLUME_BACKGROUND = "rgb(0, 0, 0)";
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
