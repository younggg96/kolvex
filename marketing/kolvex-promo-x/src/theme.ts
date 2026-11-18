// Kolvex design tokens for the promo — copied from kolvex-frontend-web-nextjs/app/globals.css (dark theme)
// and public/icon.svg. Every colour in the video comes from here.
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] });

export const K = {
  bg: '#000000', // --background 0 0 0
  card: 'rgb(14,15,16)', // --card
  muted: 'rgb(22,23,25)', // --muted
  border: 'rgb(40,42,45)', // --border
  fg: '#ffffff', // --foreground
  fg2: 'rgb(155,160,166)', // --muted-foreground
  green: 'rgb(0,200,5)', // --primary (dark)
  logo: '#53d22d', // public/icon.svg fill
  bear: 'rgb(255,80,0)', // --negative (dark)
  radiusCard: 16,
  radiusControl: 10,
} as const;

// Inter first (the product font), then CJK fallbacks for creator names inside overlays.
export const FONT = `${fontFamily}, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`;

export const rgba = (rgb: string, a: number) => rgb.replace('rgb(', 'rgba(').replace(')', `,${a})`);
export const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// Kolvex candlestick mark (public/icon.svg path, viewBox 0 -960 960 960)
export const KOLVEX_ICON_PATH =
  'M280-160v-80h-80v-480h80v-80h80v80h80v480h-80v80h-80Zm0-160h80v-320h-80v320Zm320 160v-200h-80v-280h80v-160h80v160h80v280h-80v200h-80Zm0-280h80v-120h-80v120Zm-280-40Zm320-20Z';
