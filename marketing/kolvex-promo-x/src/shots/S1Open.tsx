// S1 · Opening — card blur-slide (demos/typography/blur-slide/BlurSlide.tsx), reskinned to Kolvex.
// Over the real signed-in Markets dashboard, blurred and dimmed — the "noise" the line talks about. Words rise out of blur on ONE shared progress per word;
// line 2 follows after a 6 f breath, the accent word lands last with a longer window.
//   0–24   masthead hairline draws; aurora fades up
//   8–40   line 1 "Less noise." (2 words, 4 f stagger, 22 f windows)
//   26–64  line 2 "Better stock research." — accent "research." 30 f window
//   64–112 hold (slow 1→1.03 push, smooth)
//   exit is the shared depth dissolve in Main
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { EASE, ramp } from '../fixtures/Polish';
import { Words, Word } from '../components/Type';
import { FONT, K, KOLVEX_ICON_PATH } from '../theme';

export const S1_DEFAULTS = {
  line1: 'Less noise.',
  line2: 'Better stock',
  accent: 'research.',
  masthead: 'AI stock research & creator insights',
};

const LEFT = 168;

export const S1Open: React.FC<Partial<typeof S1_DEFAULTS>> = (props) => {
  const c = { ...S1_DEFAULTS, ...props };
  const frame = useCurrentFrame();
  const push = 1 + 0.03 * ramp(frame, 0, 121, EASE.smooth);
  const rule = ramp(frame, 0, 24, EASE.snappy);
  const aur = ramp(frame, 0, 40, EASE.out);
  const l1: Word[] = c.line1.split(' ').map((text, i) => ({ text, start: 8 + i * 4, dur: 22 }));
  const l2words = c.line2.split(' ');
  const l2: Word[] = [
    ...l2words.map((text, i) => ({ text, start: 26 + i * 4, dur: 22 })),
    { text: c.accent, start: 26 + l2words.length * 4, dur: 30, color: K.green },
  ];
  const headline: React.CSSProperties = { fontFamily: FONT, fontSize: 150, fontWeight: 600, lineHeight: 1, letterSpacing: '-0.045em', color: K.fg };
  return (
    <AbsoluteFill style={{ background: K.bg }}>
      {/* the real Markets dashboard, out of focus: busy, unreadable — noise */}
      <Img
        src={staticFile('textures/dashboard/markets.png')}
        style={{
          position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, opacity: 0.55 * aur,
          filter: `blur(${(10 - 7 * ramp(frame, 60, 55, EASE.smooth)).toFixed(2)}px) saturate(0.9)`, transform: `scale(${(1.12 - 0.06 * ramp(frame, 0, 121, EASE.smooth)).toFixed(4)})`, transformOrigin: '70% 45%',
        }}
      />
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.78) 45%, rgba(0,0,0,0.45) 100%)' }} />
      {/* masthead: texture-level furniture, static (page furniture does not push) */}
      <div style={{ position: 'absolute', left: LEFT, right: LEFT, top: 92, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: FONT, opacity: 0.35 + 0.65 * rule }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width={34} height={34} viewBox="0 -960 960 960"><path d={KOLVEX_ICON_PATH} fill={K.logo} /></svg>
          <span style={{ fontSize: 28, fontWeight: 700, color: K.fg, letterSpacing: '-0.01em' }}>Kolvex</span>
        </div>
        <span style={{ fontSize: 32, fontWeight: 500, color: K.fg2, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{c.masthead}</span>
      </div>
      <div style={{ position: 'absolute', left: LEFT, top: 146, width: 1920 - LEFT * 2, height: 1, background: K.border, transform: `scaleX(${rule.toFixed(4)})`, transformOrigin: '0 50%' }} />
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${push.toFixed(5)})`, transformOrigin: `${LEFT}px 560px` }}>
        <Words words={l1} dy={57} blur={18} gap="0.24em" style={{ ...headline, position: 'absolute', left: LEFT - 8, top: 392 }} />
        <Words words={l2} dy={57} blur={18} gap="0.24em" style={{ ...headline, position: 'absolute', left: LEFT - 8, top: 572 }} />
      </div>
    </AbsoluteFill>
  );
};
