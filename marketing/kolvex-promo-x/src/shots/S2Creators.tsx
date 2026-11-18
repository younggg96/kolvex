// S2 · Creator opinions — card crane-rise-reveal (demos/opening/crane-rise-reveal/CraneRiseReveal.tsx).
// World = the signed-in YouTube opinions page (textures/dashboard/opinions.png) in a window on the right.
// Camera starts at 2.3× on ONE real row (MSFT · Mildly bullish · 12 creators, 109 opinions · 6 / 4 / 2), the other rows
// dimmed to 38%; after a breath it cranes back along bezier(0.2,0,0.25,1) — focus point and scale share ONE
// progress. Rows wash green as the bottom of the view first crosses them (solved per frame).
// The caption column fades in on the left once the window has cleared it.
// Camera uses CSS `zoom` (layout-level) so the 1.67× texture rasterizes sharp (Q2).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, bezier, mix, ramp } from '../fixtures/Polish';
import { Caption } from '../components/Type';
import { DashWindow, KP, PX, PY } from '../components/Dash';
import { CRANE_HOLD, CRANE_MOVE } from '../timeline';
import { K, rgba } from '../theme';

export const S2_DEFAULTS = {
  eyebrow: 'CREATOR OPINIONS',
  headline: 'Track what financial creators are saying.',
  sub: '14 creators. 2,883 opinions. Each one sourced.',
  url: 'kolvex.app/dashboard/youtube-opinions',
};

// opinion rows on the page (CSS px, measured on the capture): 10 rows, 90 px pitch
const ROW = { x: 322, w: 1160, y0: 172, h: 90, n: 10 };
const rowTop = (i: number) => ROW.y0 + i * ROW.h;
const TRACK = 4; // MSFT

const S0 = 2.3;
const crane = bezier(0.2, 0, 0.25, 1);
const MOVE_END = CRANE_HOLD + CRANE_MOVE;
const F0 = { x: PX(ROW.x) - 40 + 960 / S0, y: PY(rowTop(TRACK) + ROW.h / 2) + 95 / S0 };
const F1 = { x: 960, y: 540 };
const camAt = (frame: number) => {
  const breath = ramp(frame, 0, CRANE_HOLD, EASE.smooth);
  const e = crane(Math.min(1, Math.max(0, (frame - CRANE_HOLD) / CRANE_MOVE)));
  const s0 = S0 * (1 + 0.015 * breath);
  const s = mix(s0, 1, e);
  const fx = mix(F0.x, F1.x, e);
  const fy = mix(F0.y, F1.y, e);
  return { s, e, fx, fy, visTop: fy - 540 / s, visBot: fy + 540 / s };
};
// a row washes the first frame it is fully inside the view (rows enter from above and below as the crane rises)
const inView = (f: number, i: number) => { const c = camAt(f); return c.visTop <= PY(rowTop(i)) + 2 && c.visBot >= PY(rowTop(i) + ROW.h) - 2; };
const WASH = Array.from({ length: ROW.n }, (_, i) => {
  if (i === TRACK || inView(CRANE_HOLD, i)) return -1;
  for (let f = CRANE_HOLD; f <= MOVE_END; f++) if (inView(f, i)) return f;
  return -1;
});

const Overlays: React.FC<{ frame: number }> = ({ frame }) => {
  const focus = mix(0.38, 1, ramp(frame, CRANE_HOLD - 2, 28, EASE.out));
  const local = (x: number) => x * KP; // page CSS → window-content px
  return (
    <>
      {/* dim everything except the tracked row during the close-up */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920 * KP, height: local(rowTop(TRACK)), background: K.bg, opacity: 1 - focus }} />
      <div style={{ position: 'absolute', left: 0, top: local(rowTop(TRACK) + ROW.h), width: 1920 * KP, height: 1080 * KP, background: K.bg, opacity: 1 - focus }} />
      {WASH.map((t, i) => {
        if (t < 0) return null;
        const p = ramp(frame, t, 20, EASE.out);
        const op = Math.min(1, ramp(frame, t, 3, EASE.linear)) * (1 - ramp(frame, t + 6, 18, EASE.out));
        if (op <= 0.002) return null;
        const head = mix(-0.2, 1.1, p);
        return (
          <div key={i} style={{
            position: 'absolute', left: local(ROW.x - 12), top: local(rowTop(i)) + 2, width: local(ROW.w + 24), height: local(ROW.h) - 4, borderRadius: 10, opacity: op,
            background: `linear-gradient(90deg, ${rgba(K.green, 0.02)} 0%, ${rgba(K.green, 0.14)} ${(head * 100).toFixed(1)}%, ${rgba(K.green, 0)} ${((head + 0.22) * 100).toFixed(1)}%)`,
            boxShadow: `inset 0 0 0 1px ${rgba(K.green, 0.22)}`,
          }} />
        );
      })}
      <div style={{
        position: 'absolute', left: local(ROW.x - 12), top: local(rowTop(TRACK)) + 1, width: local(ROW.w + 24), height: local(ROW.h) - 2, borderRadius: 10,
        boxShadow: `inset 0 0 0 1.5px ${rgba(K.green, 0.6 * (1 - 0.75 * ramp(frame, CRANE_HOLD + 40, 40, EASE.out)))}`,
      }} />
    </>
  );
};

export const S2Creators: React.FC<Partial<typeof S2_DEFAULTS>> = (props) => {
  const c = { ...S2_DEFAULTS, ...props };
  const frame = useCurrentFrame();
  const { s, fx, fy } = camAt(frame);
  const elev = mix(4, 34, ramp(frame, CRANE_HOLD + 30, CRANE_MOVE - 20, EASE.swift));
  const vig = 1 - ramp(frame, CRANE_HOLD, 60, EASE.swift);
  return (
    <AbsoluteFill style={{ background: K.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 70% at 70% 55%, ${rgba(K.green, 0.07 * ramp(frame, CRANE_HOLD + 30, 60, EASE.out))} 0%, rgba(0,0,0,0) 70%)` }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, zoom: s, transform: `translate(${(960 / s - fx).toFixed(3)}px, ${(540 / s - fy).toFixed(3)}px)` }}>
        <DashWindow src="textures/dashboard/opinions.png" url={c.url} elevation={elev}>
          <Overlays frame={frame} />
        </DashWindow>
      </div>
      <AbsoluteFill style={{ pointerEvents: 'none', opacity: vig, background: 'radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' }} />
      <Caption x={110} y={300} width={540} eyebrow={c.eyebrow} headline={c.headline} sub={c.sub} start={CRANE_HOLD + 52} size={66} />
    </AbsoluteFill>
  );
};
