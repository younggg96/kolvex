// Shared type + framing pieces, all on Kolvex tokens.
// <Words> is the blur-slide core (card blur-slide): opacity / translateY / blur bound to ONE progress p.
import React from 'react';
import { useCurrentFrame } from 'remotion';
import { EASE, ramp, softShadow } from '../fixtures/Polish';
import { FONT, K, rgba } from '../theme';

export type Word = { text: string; start: number; dur: number; color?: string };

export const Words: React.FC<{
  words: Word[];
  dy: number;
  blur: number;
  style: React.CSSProperties;
  gap?: string;
}> = ({ words, dy, blur, style, gap = '0.26em' }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', columnGap: gap, ...style }}>
      {words.map((w, i) => {
        const p = ramp(frame, w.start, w.dur, EASE.out);
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              whiteSpace: 'pre',
              opacity: p,
              color: w.color,
              transform: `translateY(${((1 - p) * dy).toFixed(2)}px)`,
              filter: p >= 0.999 ? undefined : `blur(${((1 - p) * blur).toFixed(2)}px)`,
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};

// Build words from a sentence. `*word*` marks the accent word (brand green, longer window, lands last).
export const sentence = (text: string, start: number, gap: number, dur: number, accent: string = K.green): Word[] => {
  let t = start;
  return text.split(' ').map((raw) => {
    const isAccent = raw.startsWith('*') && raw.endsWith('*');
    const w: Word = { text: raw.replace(/\*/g, ''), start: t, dur: isAccent ? dur + 8 : dur, color: isAccent ? accent : undefined };
    t += gap;
    return w;
  });
};

// Editorial caption block: eyebrow (green caps) → headline (blur-slide) → sub (blur-slide, smaller amplitude)
export const Caption: React.FC<{
  x: number;
  y: number;
  width: number;
  eyebrow: string;
  headline: string;
  sub?: string;
  start: number;
  size?: number;
}> = ({ x, y, width, eyebrow, headline, sub, start, size = 76 }) => {
  const frame = useCurrentFrame();
  const kick = ramp(frame, start, 18, EASE.out);
  const hStart = start + 6;
  const hWords = sentence(headline, hStart, 4, 22);
  const subStart = hStart + hWords.length * 4 + 4;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width, fontFamily: FONT }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 16, fontSize: 34, fontWeight: 600, letterSpacing: '0.12em', color: K.green,
          opacity: kick, transform: `translateY(${((1 - kick) * 14).toFixed(2)}px)`,
          filter: kick >= 0.999 ? undefined : `blur(${((1 - kick) * 6).toFixed(2)}px)`,
        }}
      >
        <span style={{ width: 12, height: 12, borderRadius: 3, background: K.green, display: 'inline-block' }} />
        {eyebrow}
      </div>
      <Words
        words={hWords}
        dy={0.38 * size}
        blur={14}
        gap="0.24em"
        style={{ marginTop: 26, fontSize: size, fontWeight: 600, lineHeight: 1.06, letterSpacing: '-0.035em', color: K.fg }}
      />
      {sub && (
        <Words
          words={sentence(sub, subStart, 2.4, 20)}
          dy={20}
          blur={8}
          gap="0.26em"
          style={{ marginTop: 30, fontSize: 38, fontWeight: 400, lineHeight: 1.3, letterSpacing: '-0.012em', color: K.fg2 }}
        />
      )}
    </div>
  );
};

// Browser-window frame around a real page texture (Kolvex card tokens + URL bar).
export const CHROME = 52;
export const Window: React.FC<{
  x: number; y: number; w: number; h: number; url: string; elevation?: number; children: React.ReactNode;
}> = ({ x, y, w, h, url, elevation = 30, children }) => (
  <div
    style={{
      position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: K.radiusCard + 4, overflow: 'hidden', background: K.bg,
      boxShadow: `0 0 0 1px ${K.border}, ${softShadow(elevation, { color: '#000000', strength: 2.2 })}, 0 30px 120px -40px ${rgba(K.green, 0.18)}`,
    }}
  >
    <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: CHROME, background: K.card, borderBottom: `1px solid ${K.border}` }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ position: 'absolute', left: 22 + i * 20, top: 20, width: 12, height: 12, borderRadius: 6, background: K.border }} />
      ))}
      <div
        style={{
          position: 'absolute', left: 96, right: 96, top: 10, height: 32, borderRadius: K.radiusControl, background: K.muted,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, fontSize: 24, fontWeight: 500, color: K.fg2,
          letterSpacing: '-0.005em',
        }}
      >
        {url}
      </div>
    </div>
    <div style={{ position: 'absolute', left: 0, top: CHROME, width: w, height: h - CHROME, overflow: 'hidden' }}>{children}</div>
  </div>
);
