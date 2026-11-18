// Shared framing for the signed-in dashboard pages (textures/dashboard/*.png = 1920×1080 CSS viewport at 1.667×,
// stitched from browser-pane tiles; personal data blurred at stitch time — see scripts/stitch_tiles.py).
// The same window geometry is used by S2 / S3a / S3b so the product stays in one place on screen.
import React from 'react';
import { Img, staticFile } from 'remotion';
import { CHROME, Window } from './Type';

export const PAGE_W = 1920;
export const PAGE_H = 1080;
export const WIN = { x: 700, w: 1180 } as const;
export const KP = WIN.w / PAGE_W; // page CSS px → world px (0.6146)
export const WIN_H = Math.round(PAGE_H * KP) + CHROME;
export const WIN_Y = Math.round((1080 - WIN_H) / 2);
export const PX = (x: number) => WIN.x + x * KP; // page CSS → world/screen (at camera 1)
export const PY = (y: number) => WIN_Y + CHROME + y * KP;

export const DashWindow: React.FC<{ src: string; url: string; elevation?: number; children?: React.ReactNode }> = ({ src, url, elevation, children }) => (
  <Window x={WIN.x} y={WIN_Y} w={WIN.w} h={WIN_H} url={url} elevation={elevation}>
    <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: 0, width: WIN.w, height: PAGE_H * KP }} />
    {children}
  </Window>
);
