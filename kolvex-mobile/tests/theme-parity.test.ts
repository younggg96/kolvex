import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { palette } from "../src/lib/palette";

const css = readFileSync(
  new URL("../../kolvex-frontend-web-nextjs/app/globals.css", import.meta.url),
  "utf8",
);
type Mode = "light" | "dark";
// Native role -> Web token. `tint` is the native neutral fill: the Web's light
// --secondary became a green selection wash, so light mode follows --muted.
const roles: Record<Mode, Record<string, string>> = {
  light: {
    background: "background",
    surface: "card",
    text: "foreground",
    secondary: "muted-foreground",
    secondaryOnTint: "muted-on-tint",
    border: "border",
    brand: "primary",
    accent: "positive",
    tint: "muted",
    negative: "negative",
    chartUp: "chart-up",
    chartDown: "chart-down",
  },
  dark: {
    background: "background",
    surface: "card",
    text: "foreground",
    secondary: "muted-foreground",
    secondaryOnTint: "muted-foreground",
    border: "border",
    brand: "primary",
    accent: "positive",
    tint: "secondary",
    negative: "negative",
    chartUp: "chart-up",
    chartDown: "chart-down",
  },
};
function block(selector: string) {
  return css.slice(css.indexOf(`${selector} {`)).split("}")[0];
}
const blocks = {
  light: [block(":root")],
  dark: [block(".dark"), block(":root")],
};
// Resolves `--name: r g b;` and `--name: var(--other);` the way the cascade does:
// the mode's own block first, then the inherited :root block.
function token(mode: Mode, name: string, seen: string[] = []): number[] {
  assert.ok(!seen.includes(name), `Circular Web token ${name}`);
  for (const source of blocks[mode]) {
    const value = source
      .match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]
      .trim();
    if (!value) continue;
    const reference = value.match(/^var\(--([\w-]+)\)$/);
    if (reference) return token(mode, reference[1], [...seen, name]);
    assert.match(
      value,
      /^\d+ \d+ \d+$/,
      `Web token ${name} is not an RGB triple`,
    );
    return value.split(/\s+/).map(Number);
  }
  assert.fail(`Missing Web token ${name}`);
}
function rgb(hex: string) {
  return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}
function luminance(hex: string) {
  const channels = rgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
for (const mode of ["light", "dark"] as const) {
  test(`${mode} native semantic colors match the Web CSS source`, () => {
    for (const [nativeRole, webRole] of Object.entries(roles[mode])) {
      assert.deepEqual(
        rgb(
          palette[mode][
            nativeRole as keyof (typeof palette)[typeof mode]
          ] as string,
        ),
        token(mode, webRole),
        nativeRole,
      );
    }
  });
  test(`${mode} text and directional labels retain AA contrast on reading surfaces`, () => {
    const pairs = [
      ...(["text", "secondary", "accent", "negative"] as const).flatMap(
        (foreground) =>
          (["background", "surface"] as const).map(
            (background) => [foreground, background] as const,
          ),
      ),
      // Selected controls and tinted fills use foreground or secondaryOnTint, never directional labels.
      ["text", "tint"],
      ["secondaryOnTint", "tint"],
    ] as const;
    for (const [foreground, background] of pairs) {
      const values = [
        luminance(palette[mode][foreground]),
        luminance(palette[mode][background]),
      ].sort((a, b) => a - b);
      assert.ok(
        (values[1] + 0.05) / (values[0] + 0.05) >= 4.5,
        `${foreground} on ${background}`,
      );
    }
  });
}
