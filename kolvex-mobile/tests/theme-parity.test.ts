import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { palette } from "../src/lib/palette";

const css = readFileSync(
  new URL("../../kolvex-frontend-web-nextjs/app/globals.css", import.meta.url),
  "utf8",
);
const roles = {
  background: "background",
  surface: "card",
  text: "foreground",
  secondary: "muted-foreground",
  border: "border",
  brand: "primary",
  accent: "positive",
  tint: "secondary",
  negative: "negative",
  chartUp: "chart-up",
  chartDown: "chart-down",
} as const;
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
    const selector = mode === "light" ? ":root" : ".dark";
    const block = css.slice(css.indexOf(`${selector} {`)).split("}")[0];
    for (const [nativeRole, webRole] of Object.entries(roles)) {
      const value = block.match(new RegExp(`--${webRole}:\\s*([\\d ]+);`));
      assert.ok(value, `Missing Web token ${webRole}`);
      assert.deepEqual(
        rgb(palette[mode][nativeRole as keyof typeof roles]),
        value[1].trim().split(/\s+/).map(Number),
        nativeRole,
      );
    }
  });
  test(`${mode} text and directional labels retain AA contrast on reading surfaces`, () => {
    for (const foreground of [
      "text",
      "secondary",
      "accent",
      "negative",
    ] as const) {
      for (const background of ["background", "surface", "tint"] as const) {
        // Selected controls use foreground text, never directional labels.
        if (
          background === "tint" &&
          (foreground === "accent" || foreground === "negative")
        )
          continue;
        const values = [
          luminance(palette[mode][foreground]),
          luminance(palette[mode][background]),
        ].sort((a, b) => a - b);
        assert.ok(
          (values[1] + 0.05) / (values[0] + 0.05) >= 4.5,
          `${foreground} on ${background}`,
        );
      }
    }
  });
}
