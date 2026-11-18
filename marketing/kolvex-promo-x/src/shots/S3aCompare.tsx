// S3a · Stock opinion comparison — card scanline-annotate-focus
// (demos/effects/scanline-annotate-focus/ScanlineAnnotateFocus.tsx), reskinned to Kolvex.
// The signed-in NVDA page, Creators tab ("Creator Intelligence": Bullish / Neutral or mixed / Bearish columns).
// A reading line travels down at a strictly constant speed; when it passes a column header's bottom edge,
// four L-brackets spring in from 76 px out (damping 15, one visible overshoot) and a label types out 5 f later.
// Labels only restate what the page says. Machine colour = white (--foreground); the page owns green/orange.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { EASE, ramp } from '../fixtures/Polish';
import { springAt } from '../fixtures/Look';
import { Caption } from '../components/Type';
import { DashWindow, KP, PX, PY, WIN, WIN_Y } from '../components/Dash';
import { CHROME } from '../components/Type';
import { SCAN0, SCAN1 } from '../timeline';
import { FONT, K, rgba } from '../theme';

export const S3A_DEFAULTS = {
  eyebrow: 'NVDA · CREATORS',
  headline: 'Different perspectives.',
  sub: 'Bullish, neutral and bearish creators on one stock, side by side.',
  url: 'kolvex.app/dashboard/market/NVDA',
};

const MACHINE = K.fg;
// scan window in page CSS px (strictly linear in time)
const Y0 = 380;
const Y1 = 600; // headers + first cards; the line finishes soon after the last label
const scanY = (f: number) => Y0 + (Y1 - Y0) * Math.min(1, Math.max(0, (f - SCAN0) / (SCAN1 - SCAN0)));
const frameAtY = (y: number) => SCAN0 + ((y - Y0) / (Y1 - Y0)) * (SCAN1 - SCAN0);

type Tag = 'over';
type T = { key: string; x: number; y: number; w: number; h: number; label: string; tag: Tag; ft: number };
export const TARGETS: T[] = (() => {
  // column headers (page CSS px, measured on textures/dashboard/nvda-creators.png)
  const ts: T[] = [
    { key: 'bull', x: 290, y: 432, w: 516, h: 48, label: 'BULLISH · 2', tag: 'over', ft: 0 },
    { key: 'mixed', x: 824, y: 432, w: 517, h: 48, label: 'MIXED · 5', tag: 'over', ft: 0 },
    { key: 'bear', x: 1359, y: 432, w: 516, h: 48, label: 'BEARISH · 7', tag: 'over', ft: 0 },
  ];
  // all three share one bottom edge → fire left to right, ≥ 6 f apart (the eye reads across)
  const base = frameAtY(432 + 48);
  ts.forEach((t, i) => { t.ft = Math.round(base + i * 7); });
  return ts;
})();

const Bracket: React.FC<{ t: T; frame: number }> = ({ t, frame }) => {
  const f = frame - t.ft;
  if (f < 0) return null;
  const s = springAt(frame, t.ft, { damping: 15, stiffness: 210 });
  const pad = 76 * (1 - s);
  const op = Math.min(1, f / 3);
  const arm = 30 - 10 * ramp(frame, t.ft + 3, 12, EASE.out);
  const flash = ramp(frame, t.ft + 3, 3, EASE.out) * (1 - ramp(frame, t.ft + 6, 12, EASE.out));
  const bx = PX(t.x), by = PY(t.y), bw = t.w * KP, bh = t.h * KP;
  const x = bx - pad, y = by - pad, w = bw + pad * 2, h = bh + pad * 2;
  const d = [
    `M${x} ${y + arm}V${y}H${x + arm}`,
    `M${x + w - arm} ${y}H${x + w}V${y + arm}`,
    `M${x + w} ${y + h - arm}V${y + h}H${x + w - arm}`,
    `M${x + arm} ${y + h}H${x}V${y + h - arm}`,
  ].join('');
  return (
    <>
      <div style={{ position: 'absolute', left: bx, top: by, width: bw, height: bh, borderRadius: 8, background: `rgba(255,255,255,${(0.08 * flash).toFixed(3)})` }} />
      <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: op }}>
        <path d={d} fill="none" stroke={MACHINE} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );
};

const TAG_H = 44;
// The label lands ON the header bar it names and restates it at a readable size (Q11 ≥ 32 px):
// it covers only that header's own small text, never the creator cards below it.
const Label: React.FC<{ t: T; frame: number }> = ({ t, frame }) => {
  const s0 = t.ft + 5;
  if (frame < s0) return null;
  const pop = ramp(frame, s0, 4, EASE.out);
  const typedF = Math.min(t.label.length, (frame - s0) * 2.2 + 1);
  const typed = Math.floor(typedF);
  const bx = PX(t.x), by = PY(t.y), bw = t.w * KP, bh = t.h * KP;
  const grow = ramp(frame, s0, 8, EASE.out); // bar wipes open left→right, text types in behind it
  return (
    <div style={{
      position: 'absolute', left: bx, top: by + bh / 2 - TAG_H / 2, width: bw * grow, height: TAG_H, borderRadius: K.radiusControl,
      background: MACHINE, color: K.bg, opacity: pop, overflow: 'hidden',
      display: 'flex', alignItems: 'center', paddingLeft: 16, boxSizing: 'border-box', whiteSpace: 'pre',
      fontFamily: FONT, fontSize: 32, fontWeight: 600, letterSpacing: '0.03em', boxShadow: '0 12px 28px -12px rgba(0,0,0,0.85)',
    }}>
      {t.label.slice(0, typed)}
      {typed < t.label.length && <span style={{ display: 'inline-block', width: 12, height: 28, marginLeft: 2, background: K.bg }} />}
    </div>
  );
};

export const S3aCompare: React.FC<Partial<typeof S3A_DEFAULTS>> = (props) => {
  const c = { ...S3A_DEFAULTS, ...props };
  const frame = useCurrentFrame();
  const ly = scanY(frame);
  const lineOn = ramp(frame, SCAN0 - 4, 5, EASE.out) * (1 - ramp(frame, SCAN1, 8, EASE.exit));
  const push = 1 + 0.03 * ramp(frame, 0, 133, EASE.swift);
  const contentTop = WIN_Y + CHROME;
  return (
    <AbsoluteFill style={{ background: K.bg, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 70% at 70% 55%, ${rgba(K.green, 0.07)} 0%, rgba(0,0,0,0) 70%)` }} />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push.toFixed(5)})`, transformOrigin: '98% 50%' }}>
        <DashWindow src="textures/dashboard/nvda-creators.png" url={c.url}>
          {lineOn > 0.01 && (
            <>
              <div style={{ position: 'absolute', left: 0, width: WIN.w, top: ly * KP - 90, height: 90, opacity: lineOn, background: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.03) 60%, rgba(255,255,255,0.08) 100%)' }} />
              <div style={{ position: 'absolute', left: 0, width: WIN.w, top: ly * KP - 1.5, height: 3, opacity: lineOn, background: MACHINE, boxShadow: '0 0 10px rgba(255,255,255,0.45), 0 0 26px rgba(255,255,255,0.18)' }} />
            </>
          )}
        </DashWindow>
        {lineOn > 0.01 && (
          <svg width={20} height={24} viewBox="0 0 20 24" style={{ position: 'absolute', left: WIN.x - 28, top: contentTop + ly * KP - 12, opacity: lineOn }}>
            <path d="M2 2 L18 12 L2 22 Z" fill={MACHINE} />
          </svg>
        )}
        {TARGETS.map((t) => <Bracket key={t.key} t={t} frame={frame} />)}
        {TARGETS.map((t) => <Label key={t.key} t={t} frame={frame} />)}
      </div>
      <Caption x={110} y={330} width={540} eyebrow={c.eyebrow} headline={c.headline} sub={c.sub} start={4} size={70} />
    </AbsoluteFill>
  );
};
