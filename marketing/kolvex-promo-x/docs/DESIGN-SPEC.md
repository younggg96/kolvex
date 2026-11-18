# Kolvex · 25s X promo — design spec

Mode: **video-shotcraft autonomous free creation** (pipeline stages 0–7, no stage gates).
Skill gallery used for motion vocabulary only; no Ink Press template, no template skin.

## Stage 0 · Product brief

| Item | Decision |
|---|---|
| Product | Kolvex (kolvex.app): US-stock research for Chinese-speaking investors. Core = creator opinions (who / when / which ticker / what / how strong), each traceable to the source video; plus stock pages, AI research reports, daily briefs. |
| Audience | US stock investors and AI developers on X. |
| Message | Less noise → track creators → compare perspectives + AI research → Kolvex. |
| Must show | (1) creator opinions UI, (2) stock-level opinion comparison, (3) AI research report, (4) brand + URL. |
| Format | 1920×1080, 30 fps, 750 f (25.0 s), English captions, readable with sound off. |
| Data | Real signed-in dashboard pages of kolvex.app (Markets, YouTube opinions, NVDA → Creators tab, AI Chat), captured in the Claude browser pane on **2026-11-17** as 4×4 magnified tiles (1.67×) and stitched (`scripts/stitch_tiles.py`, `scripts/tiles.json`). Network refresh was frozen during capture so every tile shows the same moment. Numbers on screen (295 stocks / 14 creators / 2,883 opinions; NVDA 2 bullish / 5 neutral-or-mixed / 7 bearish creators; quotes) are what the pages showed then. No invented creators, opinions, returns, quotes or AI answers. **Redacted** at stitch time: account name/email card (all pages) and the "My holdings" card. The chat shot types one of the page's own suggested prompts; nothing is sent and no reply is shown. Raw unredacted tiles live only in gitignored `out/capture-tiles/`. |
| Not touched | Production web app, its code and data. Capture is read-only. |
| Audio | Mixkit "House Vibez" (Lily J, Mixkit Stock Music Free License) at low level; Freesound CC0 SFX (see `public/audio/sfx/FREESOUND-CREDITS.md`). `bgm` prop renders the no-music version from the same timeline. |

## Stage 1 · Visual direction (tokens from the product)

Chosen direction: **"Quiet terminal"** — the site's own dark theme, editorial left-column type, real UI on the right, one green accent. (Alternatives considered: light theme "paper" editorial — rejected, the public site and landing hero default to dark; neon/aurora-heavy — rejected as flashy.)

Tokens (from `kolvex-frontend-web-nextjs/app/globals.css`, dark theme, and the captured UI):

| Token | Value | Source |
|---|---|---|
| bg | `#000000` | `--background: 0 0 0` |
| card | `rgb(14,15,16)` | `--card` |
| muted surface | `rgb(22,23,25)` | `--muted` |
| border | `rgb(40,42,45)` | `--border` |
| fg / muted fg | `#fff` / `rgb(155,160,166)` | `--foreground`, `--muted-foreground` |
| brand green | `rgb(0,200,5)` | `--primary` (dark) |
| logo green | `#53d22d` | `public/icon.svg` |
| bearish | `rgb(255,80,0)` | `--negative` (dark) |
| radius | card 16 / control 10 | `--radius-card`, `--radius-control` |
| type | Inter 400–700, tight tracking on display sizes | `app/layout.tsx` (next/font Inter) |
| atmosphere | the real landing-page aurora (captured texture) | kolvex.app `/` |

Motion personality: preset **专业信赖 (fintech)** — main durations ~21–30 f, entrances `bezier(0,0,0.2,1)`/quint-out, no bounce on text or panels. The only overshoot is the scanline bracket spring (card 命门, kept) and the logo brake (card 命门, kept at 6%).

Annotation colour: the scanline card requires a "machine" colour distinct from page content. Page content already uses green (bullish) and orange (bearish), so annotations use **white** (`--foreground`) with black text — neutral, inside the token set.

Styleframe: skipped — strict product design system exists and the real UI textures are the frames; verified by `npx remotion still` frames in `out/qa/`.

## Stage 2 · Feature → shot mapping

| Feature | Card · style | Demo source | Why |
|---|---|---|---|
| Opening line | `blur-slide` | demos/typography/blur-slide/BlurSlide.tsx | low-energy default title reveal over the real Markets dashboard, blurred = "noise" |
| Creator opinions | `crane-rise-reveal` · crane | demos/opening/crane-rise-reveal/CraneRiseReveal.tsx | detail → whole: one real row (NVDA) → the full YouTube-opinions page |
| Opinion comparison | `scanline-annotate-focus` | demos/effects/scanline-annotate-focus/ScanlineAnnotateFocus.tsx | reading line + brackets name the page's own Bullish / Mixed / Bearish columns |
| AI chat | camera push (crane family) + typing | — (single move; typing per typewriter grammar) | push into the real composer, type a real suggested prompt, no answer shown |
| Brand reveal | `logo-shrink-wordmark-lockup` | demos/outro/logo-shrink-wordmark-lockup/LogoShrinkWordmarkLockup.tsx | green ring collapses into the Kolvex mark, "Meet Kolvex", URL |
| Seams | `shot-transitions` (adapted) | — | see deviations |

## Stage 3 · Storyboard (beat grid: 122 BPM, beat = 14.754 f, phase 2.6 f)

| # | Frames | Shot | Key motion | Caption (on screen) |
|---|---|---|---|---|
| S1 | 0–121 | Markets dashboard, blurred | blur-slide words, slow push | **Less noise. Better stock research.** |
| S2 | 121–327 (beat 8→22) | YouTube opinions page | 22 f hold on NVDA row at 2.3×, 96 f crane to the window; rows wash green as they enter | CREATOR OPINIONS · **Track what financial creators are saying.** · 14 creators. 2,883 opinions. Each one dated and tied to its source. |
| S3a | 327–460 (beat 22→31) | NVDA · Creators tab | uniform reading line, brackets + labels on BULLISH · 2 / MIXED · 5 / BEARISH · 7 | NVDA · CREATORS · **Different perspectives.** · Bullish, neutral and bearish creators on one stock, side by side. |
| S3b | 460–563 (beat 31→38) | AI Chat | push 1→2.2× into composer; suggested prompt typed with laptop-keyboard foley; send arrow wakes | AI CHAT · **One place.** · Ask about a stock, a creator, or your holdings. |
| S4 | 563–750 | Brand | ring → Kolvex mark (brake on beat 41), "Meet Kolvex" lockup, URL, ≥1.5 s hold | **Meet Kolvex** · kolvex.app |

## Deviations from cards (recorded per rules)

- Crane: no CameraMotionBlur (multisampling the stitched texture is expensive; the move reads fine without it). No KPI counter (would be invented data).
- Scanline: status row dropped — it would imply a product "scanning" feature. Machine colour white instead of cobalt (token fidelity). The three column headers share one bottom edge, so they fire 7 f apart left→right.
- S3b is a single camera push + typing instead of a library card: the chat page is mostly empty, so the honest move is to show its real composer and a real suggested prompt; no AI output is shown.
- Theme: the signed-in pages were captured in the account's dark theme (matches the landing page); light theme would need a re-capture.
- Transitions: dark-to-dark "depth dissolve" (outgoing blur + slight push, incoming settles) instead of white flash-cut; white flashes clash with the dark premium look (Q4).
- Logo: mark is the real Kolvex candlestick icon; "Meet" sits inline before the mark so the storyboard line "Meet Kolvex." is the lockup itself.

## Stage 7 · Independent review (clean-context subagent) and fixes

The first cut was reviewed against final-review.md and aesthetic-rules.md. Fixed:

1. "Admin" nav row was readable, so it is now flat-filled out of every texture. All redactions are flat fills in the surface colour, applied before the aurora, so no patch is visible.
2. Four SFX were inaudible under the music. Derived gain copies (`*-g14/-g13/-g9/-g5.mp3`, recorded in the credits), music bed 0.2 → 0.1, SFX volumes up. Measured in the render, every cue now sits about 3–12 dB above the music.
3. Short-lived sub-lines: the S2 sub is shortened and starts earlier; S3b runs 15 f longer (S4 starts at beat 39, keeping a 32 f hold).
4. S3a labels covered creator cards, so they now land on the header bars they name, at 32 px.
5. The composer cover box is replaced by a real empty-composer texture (Coons-patch fill of the placeholder).
6. Q11: eyebrows 34 px, masthead 32 px, URL bars 24 px.
7. Typing went from 23 to 15 chars/s, with keyboard foley pinned to the new length.
8. The holdings redaction smudge is now a seamless fill.

Also: the hero row is MSFT, whose "Mildly bullish" label agrees with its 6/4/2 bar (NVDA's label vs bar read as contradictory). Seams use a short dip instead of a text-over-text dissolve. The halo clears once the mark settles and the ring glow is calmer. Markets comes into focus during the S1 hold. Delivery is loudness-normalised.

Not changed:
- Mixkit commercial terms were not re-read online; check before paid use.
- No gallery reference footage was available locally, only posters.
- Not watched on a phone or in the X player.
