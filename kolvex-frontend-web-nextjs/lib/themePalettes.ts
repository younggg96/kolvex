/**
 * Colour palettes for each theme. The tokens live in app/globals.css under
 * `:root:not(.dark)[data-light-palette="…"]` and `.dark[data-dark-palette="…"]`;
 * this file only knows the ids. Palettes recolour brand, surfaces and controls.
 * Market direction colours never change.
 */

export const THEME_PALETTES = {
  light: ["green", "mono", "sapphire", "lavender", "caramel", "navy"],
  dark: ["green", "mono", "electric", "midnight", "neon", "gold", "starry"],
} as const;

export type PaletteMode = keyof typeof THEME_PALETTES;

export type ThemePalette<M extends PaletteMode = PaletteMode> = (typeof THEME_PALETTES)[M][number];

export const DEFAULT_PALETTE = "green";

export const PALETTE_STORAGE_KEY: Record<PaletteMode, string> = {
  light: "kolvex-light-palette",
  dark: "kolvex-dark-palette",
};

export const PALETTE_ATTRIBUTE: Record<PaletteMode, string> = {
  light: "data-light-palette",
  dark: "data-dark-palette",
};

export function isThemePalette<M extends PaletteMode>(
  mode: M,
  value: unknown,
): value is ThemePalette<M> {
  return typeof value === "string" && (THEME_PALETTES[mode] as readonly string[]).includes(value);
}

export function readThemePalette<M extends PaletteMode>(mode: M): ThemePalette<M> {
  try {
    const stored = window.localStorage.getItem(PALETTE_STORAGE_KEY[mode]);
    if (isThemePalette(mode, stored)) return stored;
  } catch {
    // Storage blocked: fall back to the default palette.
  }
  return DEFAULT_PALETTE;
}

export function applyThemePalette(mode: PaletteMode, palette: string) {
  const root = document.documentElement;
  const isDefault = palette === DEFAULT_PALETTE || !isThemePalette(mode, palette);
  if (isDefault) root.removeAttribute(PALETTE_ATTRIBUTE[mode]);
  else root.setAttribute(PALETTE_ATTRIBUTE[mode], palette);
  try {
    if (isDefault) window.localStorage.removeItem(PALETTE_STORAGE_KEY[mode]);
    else window.localStorage.setItem(PALETTE_STORAGE_KEY[mode], palette);
  } catch {
    // Storage blocked: the palette still applies for this page view.
  }
}

/** Runs before first paint so a saved palette never flashes the default green. */
export const THEME_PALETTE_BOOT_SCRIPT = `(function(){var m=${JSON.stringify(
  (Object.keys(THEME_PALETTES) as PaletteMode[]).map((mode) => [
    PALETTE_STORAGE_KEY[mode],
    PALETTE_ATTRIBUTE[mode],
    THEME_PALETTES[mode].filter((id) => id !== DEFAULT_PALETTE),
  ]),
)};for(var i=0;i<m.length;i++){try{var p=localStorage.getItem(m[i][0]);if(m[i][2].indexOf(p)>-1)document.documentElement.setAttribute(m[i][1],p)}catch(e){}}})();`;
