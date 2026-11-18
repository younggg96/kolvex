// Single source of truth for timing (shots, SFX, BGM). Main.tsx and workbench.ts both import from here.
// Beat grid measured with librosa on public/audio/bgm/house-vibez.mp3: 122.0 BPM, phase 0.088 s.
export const FPS = 30;
export const TOTAL = 750; // 25.0 s
export const BEAT = (60 / 122.003) * FPS; // 14.754 f
export const PHASE = 0.0877 * FPS; // 2.63 f
export const beatF = (n: number) => Math.round(PHASE + BEAT * n);

export const SHOTS = {
  open: { from: 0, duration: beatF(8) },                            // 0–121
  creators: { from: beatF(8), duration: beatF(22) - beatF(8) },     // 121–327
  compare: { from: beatF(22), duration: beatF(31) - beatF(22) },    // 327–460
  research: { from: beatF(31), duration: beatF(39) - beatF(31) },   // 460–578
  brand: { from: beatF(39), duration: TOTAL - beatF(39) },          // 578–750 (lockup 140 f + 32 f hold)
} as const;

// Dissolve overlap between consecutive shots (frames). The incoming shot starts XFADE early.
export const XFADE = 10;

// Moments inside shots that SFX pin to (local frames, defined by the shot components' timing constants)
export const CRANE_HOLD = 22; // S2: crane starts
export const CRANE_MOVE = 96;
export const SCAN0 = 6; // S3a: scanline start / end (local)
export const SCAN1 = 80;
export const PUSH0 = 12; // S3b: camera push into the chat composer
export const PUSH_DUR = 50;
export const TYPE0 = 30; // S3b: typing starts
export const CPF = 0.5; // characters per frame = 15 chars/s (a fast but human typist)
export const TYPE_DUR = Math.ceil(33 / CPF); // "What did creators say about NVDA?" = 33 chars
export const BRAND_T = 140; // S4: frames the lockup design timeline spans (then hold)

// Output audio lag measured for Remotion AAC (~1.3 f); subtracted once here (sound-design §4.6).
const OUT_LAG = 1;
// peak = seconds from file start to its energy peak (audio-manifest.json analysis)
const cue = (peakFrame: number, file: string, peakSec: number, volume: number, duration = 90) => ({
  from: Math.max(0, Math.round(peakFrame - peakSec * FPS - OUT_LAG)),
  src: `audio/sfx/${file}`,
  volume,
  duration,
});

export type ScanTarget = { key: string; label: string; ft: number };

export const SFX = [
  // S1: soft air under the title words (whoosh peak ≈ first headline word settling)
  cue(SHOTS.open.from + 24, 'fs-423798-g14.mp3', 0.875, 1.0, 75),
  // S2: crane rise — peak at the fastest part of the move (~19% of the crane curve)
  cue(SHOTS.creators.from + CRANE_HOLD + 18, 'fs-449996-g13.mp3', 0.215, 1.0, 60),
  // S3a: scanline sweep — peak mid-scan
  cue(SHOTS.compare.from + (SCAN0 + SCAN1) / 2, 'fs-503815-g5.mp3', 1.495, 0.7, 85),
  // S3b: camera push into the chat — whoosh peak at the fastest part of the push
  cue(SHOTS.research.from + PUSH0 + PUSH_DUR * 0.35, 'fs-423798-g14.mp3', 0.875, 1.0, 70),
  // S3b: laptop keyboard foley, exactly as long as the typing (file is active from 0.04 s)
  cue(SHOTS.research.from + TYPE0, 'fs-786019-g9.mp3', 0.04, 1.0, TYPE_DUR),
  // S4: reverse swell lands on the logo brake (t=0.28 of BRAND_T) → soft impact → glass ping on the URL
  cue(SHOTS.brand.from + Math.round(0.28 * BRAND_T), 'fs-877966.mp3', 2.205, 0.42, 72),
  cue(SHOTS.brand.from + Math.round(0.28 * BRAND_T), 'fs-753338.mp3', 0.405, 0.3, 95),
  cue(SHOTS.brand.from + Math.round(0.74 * BRAND_T), 'fs-562196.mp3', 0.015, 0.6, 52),
];

// Bracket-lock clicks are derived from the scan targets (exported by the S3a shot) in Main.tsx.
export const clickCue = (absFrame: number, i: number) => cue(absFrame, 'fs-476017.mp3', 0.125, 0.45 - i * 0.05, 12);

export const BGM = { src: 'audio/bgm/house-vibez.mp3', volume: 0.1, fadeIn: 18, fadeOut: 45 };
