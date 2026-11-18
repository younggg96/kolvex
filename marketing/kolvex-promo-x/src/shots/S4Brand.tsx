// S4 · Brand — card logo-shrink-wordmark-lockup (demos/outro/logo-shrink-wordmark-lockup/LogoShrinkWordmarkLockup.tsx).
// A green split ring collapses 5.4→1 (inOutCubic) with a 6% brake overshoot; the gap heals to a white O that
// cross-fades into the real Kolvex candlestick mark on the brake (mark never rotates). The mark slides to
// make room, "Meet" and "Kolvex" letters slide in, then the URL settles. Design coords 480×270, CSS zoom ×4.
// Timeline spans BRAND_T (140 f); everything after is a clean hold (≥ 1.5 s).
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { DesignStage, E, lerp, seg } from '../fixtures/Motion';
import { Grain, Vignette } from '../fixtures/Polish';
import { BRAND_T } from '../timeline';
import { FONT, K, KOLVEX_ICON_PATH, rgba } from '../theme';

export const S4_DEFAULTS = {
  lead: 'Meet',
  wordmark: 'Kolvex',
  url: 'kolvex.app',
};

const ICON = 30;
const MARK = 30;
const MEET_W = 50.5; // measured on render: Inter 400 22px "Meet"
const WORD_W = 70; // measured on render: Inter 700 22px "Kolvex"
const G1 = 9; // Meet → mark
const G2 = 7; // mark → wordmark
const GROUP = MEET_W + G1 + ICON + G2 + WORD_W;
const SHIFT = -GROUP / 2 + MEET_W + G1 + ICON / 2; // final mark centre relative to stage centre
const DT = 1 / BRAND_T;

const arcPath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
};
const Arcs: React.FC<{ col: string; w: number; blur: number; opacity: number }> = ({ col, w, blur, opacity }) => (
  <g opacity={opacity}>
    {[[-32, 122], [148, 302]].map(([b0, b1], i) => (
      <path key={i} d={arcPath(15, 15, 10.5, b0, b1)} fill="none" stroke={col} strokeWidth={w} strokeLinecap="round" style={blur ? { filter: `blur(${blur}px)` } : undefined} />
    ))}
  </g>
);

const scaleAt = (t: number) => lerp(seg(t, 0.02, 0.28, E.inOutCubic), 5.4, 1) * (1 + Math.sin(seg(t, 0.26, 0.37) * Math.PI) * 0.06);
const spinAt = (t: number) => -150 * seg(t, 0.0, 0.3, E.outCubic);

export const S4Brand: React.FC<Partial<typeof S4_DEFAULTS>> = (props) => {
  const c = { ...S4_DEFAULTS, ...props };
  const frame = useCurrentFrame();
  const t = Math.min(1, frame / BRAND_T);
  const s = scaleAt(t);
  const shift = seg(t, 0.34, 0.47, E.inOutCubic) * SHIFT;
  const heal = seg(t, 0.1, 0.28, E.inOutQuad);
  const markIn = seg(t, 0.24, 0.32, E.inOutQuad);
  const trail = Math.min(1, Math.abs(scaleAt(t) - scaleAt(t - DT)) / 0.35);
  const wave = seg(t, 0.28, 0.46, E.outCubic);
  const haloR = lerp(seg(t, 0.02, 0.3, E.inOutCubic), 150, 34);
  const haloA = 0.3 * (1 - seg(t, 0.3, 0.6, E.outCubic));
  const letters = [...c.wordmark];
  const STAG = (0.66 - 0.48) / letters.length;
  const rowLeft = SHIFT + ICON / 2 + G2; // wordmark left edge, relative to centre
  const meetIn = seg(t, 0.44, 0.56, E.outCubic);
  const urlIn = seg(t, 0.72, 0.84, E.outQuad);

  const icon = (sc: number, rot: number, opacity: number, ghost = false) => (
    <div style={{
      position: 'absolute', left: '50%', top: '50%', width: ICON, height: ICON, margin: `${-ICON / 2}px 0 0 ${-ICON / 2}px`,
      transform: `translateX(${shift}px) scale(${sc})`, opacity,
    }}>
      <svg viewBox="0 0 30 30" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', transform: `rotate(${rot}deg)` }}>
        <Arcs col={rgba(K.green, 0.4)} w={6.5} blur={2.5} opacity={1 - heal} />
        {!ghost && <Arcs col={heal > 0.5 ? '#ffffff' : '#d9ffe0'} w={3.4} blur={0} opacity={(1 - heal * 0.75) * (1 - markIn)} />}
        {!ghost && <circle cx={15} cy={15} r={10.5} fill="none" stroke="#fff" strokeWidth={5.5} opacity={heal * (1 - markIn)} />}
      </svg>
      {!ghost && markIn > 0 && (
        <svg viewBox="0 -960 960 960" style={{ position: 'absolute', left: (ICON - MARK) / 2, top: (ICON - MARK) / 2, width: MARK, height: MARK, opacity: markIn }}>
          <path d={KOLVEX_ICON_PATH} fill={K.logo} />
        </svg>
      )}
    </div>
  );

  return (
    <AbsoluteFill style={{ background: K.bg }}>
      <DesignStage bg={K.bg} raster="zoom">
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #050806 0%, #020302 60%, #000 100%)' }} />
          <div style={{
            position: 'absolute', left: `calc(50% + ${shift}px - ${haloR}px)`, top: `calc(50% - ${haloR}px)`, width: haloR * 2, height: haloR * 2, borderRadius: '50%',
            opacity: haloA, background: `radial-gradient(circle, ${rgba(K.green, 0.34)} 0%, ${rgba(K.green, 0.1)} 38%, ${rgba(K.green, 0)} 70%)`,
          }} />
          {wave > 0 && wave < 1 && (
            <div style={{
              position: 'absolute', left: `calc(50% + ${shift}px - ${lerp(wave, 16, 70)}px)`, top: `calc(50% - ${lerp(wave, 16, 70)}px)`,
              width: lerp(wave, 32, 140), height: lerp(wave, 32, 140), borderRadius: '50%', boxSizing: 'border-box',
              border: `${lerp(wave, 0.9, 0.25)}px solid rgba(220,255,225,${(0.5 * (1 - wave)).toFixed(3)})`,
              boxShadow: `0 0 ${lerp(wave, 4, 10)}px ${rgba(K.green, 0.4 * (1 - wave))}`,
            }} />
          )}
          {trail > 0.02 && icon(scaleAt(t - 2 * DT), spinAt(t - 2 * DT), 0.16 * trail, true)}
          {trail > 0.02 && icon(scaleAt(t - DT), spinAt(t - DT), 0.3 * trail, true)}
          {icon(s, spinAt(t), 1)}
          {/* "Meet" — lead word, lighter weight, left of the mark */}
          <div style={{
            position: 'absolute', left: `calc(50% + ${SHIFT - ICON / 2 - G1 - MEET_W}px)`, top: '50%', height: ICON, marginTop: -ICON / 2,
            display: 'flex', alignItems: 'center', font: `400 22px/1 ${FONT}`, color: K.fg2, letterSpacing: -0.2,
            opacity: meetIn, transform: `translateX(${lerp(meetIn, -8, 0)}px)`, filter: meetIn < 0.999 ? `blur(${lerp(meetIn, 2.5, 0).toFixed(2)}px)` : undefined,
          }}>{c.lead}</div>
          {/* wordmark letters */}
          <div style={{ position: 'absolute', left: `calc(50% + ${rowLeft}px)`, top: '50%', height: ICON, marginTop: -ICON / 2, display: 'flex', alignItems: 'center' }}>
            {letters.map((ch, i) => {
              const lk = seg(t, 0.48 + i * STAG, 0.48 + i * STAG + 0.1, E.outCubic);
              return (
                <span key={i} style={{
                  color: K.fg, font: `700 22px/1 ${FONT}`, letterSpacing: -0.2, whiteSpace: 'pre', opacity: lk,
                  transform: `translateX(${lerp(lk, 8, 0)}px)`, filter: lk < 0.999 ? `blur(${lerp(lk, 2.5, 0).toFixed(2)}px)` : undefined,
                }}>{ch}</span>
              );
            })}
          </div>
          {/* URL — the most important small line in the film (Q11: ≥ 32 px final) */}
          <div style={{
            position: 'absolute', left: 0, right: 0, top: 'calc(50% + 30px)', textAlign: 'center', color: K.green,
            font: `600 12px/1 ${FONT}`, letterSpacing: 0.4, opacity: urlIn, transform: `translateY(${lerp(seg(t, 0.72, 0.86, E.outCubic), 3, 0)}px)`,
          }}>{c.url}</div>
        </div>
      </DesignStage>
      <Vignette strength={0.5} inner={0.4} color="#000000" />
      <Grain opacity={0.05} blend="soft-light" />
    </AbsoluteFill>
  );
};
