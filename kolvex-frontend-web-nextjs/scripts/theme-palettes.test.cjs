const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(ROOT, "app/globals.css"), "utf8");
const lib = fs.readFileSync(path.join(ROOT, "lib/themePalettes.ts"), "utf8");
const locales = ["en", "zh"].map((locale) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, `lib/i18n/locales/${locale}.json`), "utf8")),
);

function ids(mode) {
  const list = lib.match(new RegExp(`${mode}: (\\[[^\\]]+\\])`))[1];
  return JSON.parse(list).filter((id) => id !== "green");
}

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return null;
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(\d+) (\d+) (\d+);/g)].map((m) => [
      m[1],
      [+m[2], +m[3], +m[4]],
    ]),
  );
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function legible(id, fg, bg, label, min = 4.5) {
  assert.ok(contrast(fg, bg) >= min, `${id}: ${label} ${contrast(fg, bg).toFixed(2)} < ${min}`);
}

const WHITE = [255, 255, 255];

test("palettes pin the market direction colours", () => {
  const light = block(":root:not(.dark)[data-light-palette]");
  assert.deepEqual(light["market-up"], [22, 163, 74]);
  assert.deepEqual(light.positive, [22, 101, 52]);
  assert.deepEqual(block(".dark[data-dark-palette]")["market-up"], [0, 200, 5]);
});

const LIGHT_REQUIRED = [
  "primary",
  "button-primary",
  "primary-hover",
  "primary-accent",
  "primary-soft",
  "background",
  "surface-hover",
  "border",
  "secondary",
  "secondary-foreground",
  "field-edge",
];

for (const id of ids("light")) {
  test(`light ${id} palette defines every token and keeps text legible`, () => {
    const t = block(`:root:not(.dark)[data-light-palette="${id}"]`);
    assert.ok(t, `missing CSS block for ${id}`);
    for (const name of LIGHT_REQUIRED) assert.ok(t[name], `${id} is missing --${name}`);
    assert.equal(t["market-up"], undefined, `${id} must not override --market-up`);

    legible(id, t["primary-foreground"] ?? WHITE, t["button-primary"], "text on button");
    legible(id, t["primary-hover"], t.background, "primary-hover text");
    legible(id, t["secondary-foreground"], t.secondary, "secondary pair");
    legible(id, t["field-edge"], WHITE, "field edge", 3);
    legible(id, t.primary, WHITE, "primary on surface", 3);
    legible(id, [100, 116, 139], t.background, "muted text on background");
    legible(id, [71, 85, 105], t["surface-hover"], "muted on hover");
  });
}

const DARK_REQUIRED = [
  "primary",
  "button-primary",
  "primary-hover",
  "primary-soft",
  "background",
  "sidebar",
  "card",
  "muted",
  "secondary",
  "border",
];

for (const id of ids("dark")) {
  test(`dark ${id} palette defines every token and keeps text legible`, () => {
    const t = block(`.dark[data-dark-palette="${id}"]`);
    assert.ok(t, `missing CSS block for ${id}`);
    for (const name of DARK_REQUIRED) assert.ok(t[name], `${id} is missing --${name}`);
    assert.equal(t["market-up"], undefined, `${id} must not override --market-up`);

    legible(id, t["primary-foreground"] ?? WHITE, t["button-primary"], "text on button");
    for (const surface of ["card", "muted"]) {
      legible(id, t.primary, t[surface], `primary on ${surface}`);
      legible(id, [155, 160, 166], t[surface], `muted text on ${surface}`);
      legible(id, [0, 200, 5], t[surface], `up colour on ${surface}`);
      legible(id, [255, 80, 0], t[surface], `down colour on ${surface}`);
    }
    legible(id, [155, 160, 166], t.secondary, "muted text on secondary");
  });
}

test("every palette has a swatch and both translations", () => {
  for (const mode of ["light", "dark"]) {
    for (const id of ["green", ...ids(mode)]) {
      assert.ok(
        css.includes(`.palette-swatch[data-mode="${mode}"][data-palette="${id}"]`),
        `${mode} ${id} swatch`,
      );
      for (const locale of locales) {
        assert.ok(locale.settings.preferences.palettes[mode][id], `${mode} ${id} label`);
        assert.ok(locale.settings.preferences.palette[mode], `${mode} row label`);
      }
    }
  }
});
