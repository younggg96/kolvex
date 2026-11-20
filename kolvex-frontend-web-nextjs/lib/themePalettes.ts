/**
 * Colour palettes for each theme. The tokens live in app/globals.css under
 * `:root:not(.dark)[data-light-palette="…"]` and `.dark[data-dark-palette="…"]`;
 * this file only knows the ids. Palettes recolour brand, surfaces and controls.
 * Market direction colours never change.
 *
 * "Follow the market" (跟随大盘) overrides the chosen palettes while it is on:
 * the S&P 500's move today picks green or red, and outside the regular session
 * the page turns mono. The manual choice stays stored and comes back when it
 * is switched off.
 */

export const THEME_PALETTES = {
  light: ["green", "mono", "sunrise", "red", "deepsea", "slate"],
  dark: ["green", "mono", "sunrise", "red", "deepsea", "slate"],
} as const;

export type PaletteMode = keyof typeof THEME_PALETTES;

export type ThemePalette<M extends PaletteMode = PaletteMode> = (typeof THEME_PALETTES)[M][number];

export const DEFAULT_PALETTE = "green";

const PALETTE_MODES = Object.keys(THEME_PALETTES) as PaletteMode[];

export const PALETTE_STORAGE_KEY: Record<PaletteMode, string> = {
  light: "kolvex-light-palette",
  dark: "kolvex-dark-palette",
};

export const PALETTE_ATTRIBUTE: Record<PaletteMode, string> = {
  light: "data-light-palette",
  dark: "data-dark-palette",
};

/** "on" while the palette follows the market. */
export const MARKET_PALETTE_STORAGE_KEY = "kolvex-palette-follow-market";
/** The last palette the market picked, so a reload paints it before any fetch. */
export const MARKET_PALETTE_LAST_KEY = "kolvex-palette-market-last";
/** Fired on window when the follow-market setting changes in this tab. */
export const MARKET_PALETTE_EVENT = "kolvex:palette-follow-market";
/** The index that stands for 大盘. */
export const MARKET_PALETTE_INDEX = "^GSPC";

export type MarketPalette = "green" | "red" | "mono";

/** Down → red; up or flat → green; outside the regular session → mono. */
export function marketPalette(sessionOpen: boolean, changePercent: number): MarketPalette {
  if (!sessionOpen) return "mono";
  return changePercent < 0 ? "red" : "green";
}

export function isThemePalette<M extends PaletteMode>(
  mode: M,
  value: unknown,
): value is ThemePalette<M> {
  return typeof value === "string" && (THEME_PALETTES[mode] as readonly string[]).includes(value);
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the change still applies for this page view.
  }
}

export function readThemePalette<M extends PaletteMode>(mode: M): ThemePalette<M> {
  const stored = readStorage(PALETTE_STORAGE_KEY[mode]);
  return isThemePalette(mode, stored) ? stored : DEFAULT_PALETTE;
}

/** Paints a palette on the page without touching the stored choice. */
export function paintThemePalette(mode: PaletteMode, palette: string) {
  const root = document.documentElement;
  if (palette === DEFAULT_PALETTE || !isThemePalette(mode, palette)) {
    root.removeAttribute(PALETTE_ATTRIBUTE[mode]);
  } else {
    root.setAttribute(PALETTE_ATTRIBUTE[mode], palette);
  }
}

/** Saves and paints the user's own palette for one theme. */
export function applyThemePalette(mode: PaletteMode, palette: string) {
  const isDefault = palette === DEFAULT_PALETTE || !isThemePalette(mode, palette);
  writeStorage(PALETTE_STORAGE_KEY[mode], isDefault ? null : palette);
  if (!readFollowMarket()) paintThemePalette(mode, palette);
}

/** Puts the user's own palettes back on the page. */
export function paintChosenPalettes() {
  for (const mode of PALETTE_MODES) paintThemePalette(mode, readThemePalette(mode));
}

/** Paints a market palette on both themes and remembers it for the next load. */
export function paintMarketPalette(palette: MarketPalette) {
  for (const mode of PALETTE_MODES) paintThemePalette(mode, palette);
  writeStorage(MARKET_PALETTE_LAST_KEY, palette);
}

export function readFollowMarket(): boolean {
  return readStorage(MARKET_PALETTE_STORAGE_KEY) === "on";
}

export function writeFollowMarket(on: boolean) {
  writeStorage(MARKET_PALETTE_STORAGE_KEY, on ? "on" : null);
  if (!on) {
    writeStorage(MARKET_PALETTE_LAST_KEY, null);
    paintChosenPalettes();
  }
  window.dispatchEvent(new Event(MARKET_PALETTE_EVENT));
}

/** Runs before first paint so a saved palette never flashes the default green. */
export const THEME_PALETTE_BOOT_SCRIPT = `(function(){var m=${JSON.stringify(
  PALETTE_MODES.map((mode) => [
    PALETTE_STORAGE_KEY[mode],
    PALETTE_ATTRIBUTE[mode],
    THEME_PALETTES[mode].filter((id) => id !== DEFAULT_PALETTE),
  ]),
)};try{var follow=localStorage.getItem(${JSON.stringify(
  MARKET_PALETTE_STORAGE_KEY,
)})==="on",last=localStorage.getItem(${JSON.stringify(
  MARKET_PALETTE_LAST_KEY,
)})}catch(e){return}for(var i=0;i<m.length;i++){var p=follow?last:localStorage.getItem(m[i][0]);if(m[i][2].indexOf(p)>-1)document.documentElement.setAttribute(m[i][1],p)}})();`;
