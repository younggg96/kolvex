// Kolvex promo — main timeline. All timing comes from timeline.ts (single source of truth).
import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { EASE, ramp } from './fixtures/Polish';
import { BGM, SFX, SHOTS, TOTAL, XFADE, clickCue } from './timeline';
import { K } from './theme';
import { S1Open } from './shots/S1Open';
import { S2Creators } from './shots/S2Creators';
import { S3aCompare, TARGETS } from './shots/S3aCompare';
import { S3bResearch } from './shots/S3bResearch';
import { S4Brand } from './shots/S4Brand';

// Depth dissolve (dark-to-dark seam): the outgoing shot softens back (blur + slight push + fade) during
// the XFADE overlap while the incoming shot (on top) fades in. One seam style for the whole film.
export const ShotWrap: React.FC<{ duration: number; fadeIn: boolean; fadeOut: boolean; children: React.ReactNode }> = ({ duration, fadeIn, fadeOut, children }) => {
  const f = useCurrentFrame();
  const inP = fadeIn ? ramp(f, 4, XFADE - 4, EASE.out) : 1; // incoming starts after the outgoing is mostly gone (no text-over-text)
  const outP = fadeOut ? ramp(f, duration, 7, EASE.swift) : 0;
  return (
    <AbsoluteFill style={{
      opacity: inP * (1 - outP),
      transform: outP > 0 ? `scale(${(1 + 0.04 * outP).toFixed(4)})` : undefined,
      filter: outP > 0.001 ? `blur(${(10 * outP).toFixed(2)}px)` : undefined,
    }}>
      {children}
    </AbsoluteFill>
  );
};

export const CLICKS = TARGETS.map((t, i) => clickCue(SHOTS.compare.from + t.ft + 2, i));
export const ALL_SFX = [...SFX, ...CLICKS].sort((a, b) => a.from - b.from);

const ORDER = [
  { id: 'open', C: S1Open },
  { id: 'creators', C: S2Creators },
  { id: 'compare', C: S3aCompare },
  { id: 'research', C: S3bResearch },
  { id: 'brand', C: S4Brand },
] as const;

export type MainProps = { bgm: boolean };

export const Main: React.FC<Partial<MainProps>> = ({ bgm = true }) => (
  <AbsoluteFill style={{ background: K.bg }}>
    {ORDER.map(({ id, C }, i) => {
      const s = SHOTS[id];
      const last = i === ORDER.length - 1;
      return (
        <Sequence key={id} from={s.from} durationInFrames={s.duration + (last ? 0 : XFADE)} name={id}>
          <ShotWrap duration={s.duration} fadeIn={i > 0} fadeOut={!last}>
            <C />
          </ShotWrap>
        </Sequence>
      );
    })}
    {ALL_SFX.map((s, i) => (
      <Sequence key={`sfx${i}`} from={s.from} durationInFrames={s.duration} name={`sfx ${s.src.split('/').pop()}`}>
        <Audio src={staticFile(s.src)} volume={s.volume} />
      </Sequence>
    ))}
    {bgm && (
      <Audio
        src={staticFile(BGM.src)}
        volume={(f) => BGM.volume * interpolate(f, [0, BGM.fadeIn, TOTAL - BGM.fadeOut, TOTAL - 1], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
      />
    )}
  </AbsoluteFill>
);
