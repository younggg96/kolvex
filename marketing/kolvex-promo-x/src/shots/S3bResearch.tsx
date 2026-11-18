// S3b · AI Chat — "One place."
// The signed-in AI Chat page (textures/dashboard/chat.png). Starts in the shared window position (continuity with
// S3a), then one camera move (not-bouncy fintech curve) pushes in until the real composer sits low-centre at 2×.
// The first real suggested prompt ("What did creators say about NVDA?") lights up and is typed into the composer
// at human speed; the send arrow wakes. Nothing is sent and no answer is shown (no invented AI output).
// Camera uses CSS zoom so the texture rasterizes at its native 1.67× (Q2).
import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { EASE, bezier, mix, ramp } from '../fixtures/Polish';
import { Caption } from '../components/Type';
import { DashWindow, KP, PX, PY } from '../components/Dash';
import { FONT, K, rgba } from '../theme';
import { CPF, PUSH0, PUSH_DUR, TYPE0 } from '../timeline';

export const S3B_DEFAULTS = {
  eyebrow: 'AI CHAT',
  headline: 'One place.',
  sub: 'Ask about a stock, a creator, or your holdings.',
  prompt: 'What did creators say about NVDA?',
  url: 'kolvex.app/dashboard/chat',
};

// page CSS px, measured on the capture
const COMPOSER = { x: 753, y: 900, w: 669, h: 90 };
const PLACEHOLDER = { x: 766, y: 911, w: 420, h: 30 };
const SEND = { cx: 1395, cy: 961, r: 15 };
const SUGGEST = { x: 760, y: 104, w: 660, h: 26 };

const S1 = 2.2;
// composer settles low so the page's bottom edge stays just below frame and the empty page above holds the caption
const ANCHOR_Y = 1080 + 4 - (1080 - (COMPOSER.y + COMPOSER.h / 2)) * KP * S1;
const push = bezier(0.4, 0, 0.2, 1);
const camAt = (frame: number) => {
  const e = push(Math.min(1, Math.max(0, (frame - PUSH0) / PUSH_DUR)));
  const s = mix(1, S1, e);
  const fx = mix(960, PX(COMPOSER.x + COMPOSER.w / 2), e);
  const fy = mix(540, PY(COMPOSER.y + COMPOSER.h / 2), e);
  const ay = mix(540, ANCHOR_Y, e);
  return { s, tx: 960 / s - fx, ty: ay / s - fy };
};

export const S3bResearch: React.FC<Partial<typeof S3B_DEFAULTS>> = (props) => {
  const c = { ...S3B_DEFAULTS, ...props };
  const frame = useCurrentFrame();
  const { s, tx, ty } = camAt(frame);
  const hover = ramp(frame, 6, 10, EASE.out) * (1 - ramp(frame, TYPE0 + 6, 14, EASE.out));
  const n = Math.max(0, Math.min(c.prompt.length, Math.floor((frame - TYPE0) * CPF)));
  const typing = frame >= TYPE0 && n < c.prompt.length;
  const done = TYPE0 + Math.ceil(c.prompt.length / CPF);
  const wake = ramp(frame, done + 4, 8, EASE.out);
  const blink = typing || Math.floor((frame - done) / 15) % 2 === 0;
  const L = (v: number) => v * KP;
  const focus = ramp(frame, PUSH0, 30, EASE.out);
  return (
    <AbsoluteFill style={{ background: K.bg, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, zoom: s, transform: `translate(${tx.toFixed(3)}px, ${ty.toFixed(3)}px)` }}>
        <DashWindow src="textures/dashboard/chat.png" url={c.url}>
          {/* the real suggested prompt lights up (hover state) */}
          <div style={{ position: 'absolute', left: L(SUGGEST.x - 12), top: L(SUGGEST.y - 6), width: L(SUGGEST.w + 24), height: L(SUGGEST.h + 12), borderRadius: 8, background: `rgba(255,255,255,${(0.07 * hover).toFixed(3)})` }} />
          {/* composer focus ring */}
          <div style={{ position: 'absolute', left: L(COMPOSER.x), top: L(COMPOSER.y), width: L(COMPOSER.w), height: L(COMPOSER.h), borderRadius: L(22), boxShadow: `0 0 0 ${(1.2 * focus).toFixed(2)}px ${rgba(K.green, 0.55 * focus)}, 0 0 ${(18 * focus).toFixed(1)}px ${rgba(K.green, 0.12 * focus)}` }} />
          {/* once typing starts the field is empty (placeholder painted out of the real capture: scripts/empty_composer.py) */}
          {frame >= TYPE0 && (
            <Img src={staticFile('textures/dashboard/chat-empty.png')} style={{ position: 'absolute', left: 0, top: 0, width: 1920 * KP, height: 1080 * KP }} />
          )}
          {frame >= TYPE0 && (
            <div style={{
              position: 'absolute', left: L(PLACEHOLDER.x + 8), top: L(PLACEHOLDER.y), height: L(PLACEHOLDER.h),
              display: 'flex', alignItems: 'center', fontFamily: FONT, fontSize: L(15.5), fontWeight: 400, color: K.fg, whiteSpace: 'pre', letterSpacing: '-0.005em',
            }}>
              {c.prompt.slice(0, n)}
              <span style={{ display: 'inline-block', width: L(1.3), height: L(18), marginLeft: L(1), background: K.green, opacity: blink ? 1 : 0 }} />
            </div>
          )}
          {/* send arrow wakes once there is text (not pressed) */}
          <div style={{
            position: 'absolute', left: L(SEND.cx - SEND.r), top: L(SEND.cy - SEND.r), width: L(SEND.r * 2), height: L(SEND.r * 2), borderRadius: '50%',
            background: K.fg, opacity: wake, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={L(14)} height={L(14)} viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke={K.bg} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </DashWindow>
      </div>
      <Caption x={110} y={140} width={1500} eyebrow={c.eyebrow} headline={c.headline} sub={c.sub} start={PUSH0 + 14} size={96} />
    </AbsoluteFill>
  );
};
