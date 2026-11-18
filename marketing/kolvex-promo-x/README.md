# Kolvex · 25 s promo for X

Remotion project made with the **video-shotcraft** skill (autonomous free creation). 1920×1080, 30 fps, 750 frames.

| Deliverable | File |
|---|---|
| With music (−17 LUFS, true peak ≤ −1.4 dBFS) | `out/kolvex-promo.mp4` |
| Without music (same timeline, SFX kept) | `out/kolvex-promo-nobgm.mp4` |
| Design spec: brief, tokens, shot mapping, storyboard, deviations, review | `docs/DESIGN-SPEC.md` |
| Audio sources and licences | `public/audio/sfx/FREESOUND-CREDITS.md`, `audio-manifest.json` |

## Edit

- Copy, URL bars and the typed prompt: each shot's `*_DEFAULTS` in `src/shots/`.
- Timing (shots, SFX, music): `src/timeline.ts` only (single source; Main and the workbench import it).
- Colours/fonts: `src/theme.ts` (copied from the web app's `globals.css` dark theme).
- Visual editor: the Motion Workbench (`node ~/.claude/skills/video-shotcraft/workbench/scripts/open.mjs .`, or the
  `motion-workbench` entry in the repo's `.claude/launch.json`) → http://localhost:5198/?import=project.

## Render

```bash
npm install
npx remotion render src/index.ts KolvexPromo out/render/kolvex-promo-raw.mp4
npx remotion render src/index.ts KolvexPromo out/render/kolvex-promo-nobgm-raw.mp4 --props=props-nobgm.json
```

Then loudness for delivery (linear gain to about −16 LUFS + −3 dBFS limiter, video copied):

```bash
ffmpeg -i out/render/kolvex-promo-raw.mp4 -c:v copy -af "volume=10.5dB,alimiter=limit=0.708:attack=1:release=60:level=disabled" -ar 48000 -c:a aac -b:a 256k -movflags +faststart out/kolvex-promo.mp4
```

(no-music version: same with `volume=7.5dB`; re-measure with `-af ebur128=peak=true` if the mix changes).

## Textures (real signed-in pages)

`public/textures/dashboard/*.png` were captured on 2026-11-17 in the Claude browser pane, signed in, dark theme,
as 4×4 magnified tiles, then stitched by `scripts/stitch_tiles.py` (`scripts/tiles.json` lists the tiles and the
redactions: account card, Admin nav row, My-holdings card). `scripts/empty_composer.py` makes `chat-empty.png` for the
typing shot. Raw unredacted tiles are kept only in `out/capture-tiles/` (git-ignored) — don't publish them.
