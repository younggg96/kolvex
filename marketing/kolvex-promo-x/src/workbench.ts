// Workbench manifest (video-shotcraft references/workbench.md §2–3).
// `node <skill>/workbench/scripts/open.mjs <this project>` decomposes the film into tracks:
// one clip per shot (with its depth-dissolve seam baked in, exactly like Main.tsx) + every SFX + the BGM.
// All timing is imported from timeline.ts / Main.tsx — no second copy. Copy and labels are editable via
// `schema`; motion timing (cues, eases, camera keys) is deliberately not exposed.
import { createElement, type FC } from 'react';
import { ALL_SFX, Main, ShotWrap } from './Main';
import { BGM, SHOTS, TOTAL, XFADE } from './timeline';
import { K } from './theme';
import { S1Open, S1_DEFAULTS } from './shots/S1Open';
import { S2Creators, S2_DEFAULTS } from './shots/S2Creators';
import { S3aCompare, S3A_DEFAULTS } from './shots/S3aCompare';
import { S3bResearch, S3B_DEFAULTS } from './shots/S3bResearch';
import { S4Brand, S4_DEFAULTS } from './shots/S4Brand';

type Field = Record<string, unknown> & { type: string; key: string; label: string; default: unknown };
const text = (key: string, label: string, def: string): Field => ({ type: 'text', key, label, default: def });
const textarea = (key: string, label: string, def: string): Field => ({ type: 'textarea', key, label, default: def });

// Each unit = the shot wrapped in the same seam it has in Main (fade in from the previous shot, depth-dissolve out).
const unit = <P extends object>(C: FC<P>, name: string, fadeIn: boolean, fadeOut: boolean, duration: number) => {
  const U: FC<P> = (props) => createElement(ShotWrap, { duration, fadeIn, fadeOut, children: createElement(C, props) });
  U.displayName = name;
  return U;
};

const order = [
  { id: 'open', label: 'S1 Opening · blur-slide', C: S1Open, d: S1_DEFAULTS, schema: [text('line1', 'Line 1', S1_DEFAULTS.line1), text('line2', 'Line 2', S1_DEFAULTS.line2), text('accent', 'Accent word', S1_DEFAULTS.accent), text('masthead', 'Masthead', S1_DEFAULTS.masthead)] },
  { id: 'creators', label: 'S2 Creator opinions · crane-rise', C: S2Creators, d: S2_DEFAULTS, schema: [text('eyebrow', 'Eyebrow', S2_DEFAULTS.eyebrow), textarea('headline', 'Headline', S2_DEFAULTS.headline), textarea('sub', 'Sub line', S2_DEFAULTS.sub), text('url', 'URL bar', S2_DEFAULTS.url)] },
  { id: 'compare', label: 'S3a NVDA creators · scanline', C: S3aCompare, d: S3A_DEFAULTS, schema: [text('eyebrow', 'Eyebrow', S3A_DEFAULTS.eyebrow), textarea('headline', 'Headline', S3A_DEFAULTS.headline), textarea('sub', 'Sub line', S3A_DEFAULTS.sub), text('url', 'URL bar', S3A_DEFAULTS.url)] },
  { id: 'research', label: 'S3b AI Chat · push + type', C: S3bResearch, d: S3B_DEFAULTS, schema: [text('eyebrow', 'Eyebrow', S3B_DEFAULTS.eyebrow), textarea('headline', 'Headline', S3B_DEFAULTS.headline), textarea('sub', 'Sub line', S3B_DEFAULTS.sub), text('prompt', 'Typed prompt', S3B_DEFAULTS.prompt)] },
  { id: 'brand', label: 'S4 Brand · lockup', C: S4Brand, d: S4_DEFAULTS, schema: [text('lead', 'Lead word', S4_DEFAULTS.lead), text('wordmark', 'Wordmark', S4_DEFAULTS.wordmark), text('url', 'URL', S4_DEFAULTS.url)] },
] as const;

export const WORKBENCH = {
  name: 'Kolvex · 25s X promo',
  fps: 30,
  width: 1920,
  height: 1080,
  total: TOTAL,
  background: K.bg,
  shots: order.map((o, i) => {
    const s = SHOTS[o.id];
    const last = i === order.length - 1;
    const duration = s.duration + (last ? 0 : XFADE);
    return {
      id: o.id,
      label: o.label,
      from: s.from,
      duration,
      component: unit(o.C as FC<object>, o.id, i > 0, !last, s.duration),
      props: { ...o.d },
      schema: o.schema,
      cardId: o.id,
    };
  }),
  transitions: [],
  captions: [],
  overlays: [],
  sfx: ALL_SFX.map((s) => ({ from: s.from, duration: s.duration, src: s.src, volume: s.volume })),
  bgm: [{ from: 0, duration: TOTAL, src: BGM.src, volume: BGM.volume }],
  original: Main,
};
