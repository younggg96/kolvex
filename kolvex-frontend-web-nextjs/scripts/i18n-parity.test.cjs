const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");
const en = require("../lib/i18n/locales/en.json");
const zh = require("../lib/i18n/locales/zh.json");

const root = path.resolve(__dirname, "..");

function flatten(dictionary, prefix = "") {
  return Object.fromEntries(
    Object.entries(dictionary).flatMap(([key, value]) => {
      const full = `${prefix}${key}`;
      return typeof value === "string"
        ? [[full, value]]
        : Object.entries(flatten(value, `${full}.`));
    }),
  );
}

const english = flatten(en);
const chinese = flatten(zh);
const placeholders = (value) =>
  [...new Set([...value.matchAll(/\{(\w+)\}/g)].map(([, name]) => name))].sort();

test("English and Chinese have the same translation keys and interpolation arguments", () => {
  assert.deepEqual(Object.keys(english).sort(), Object.keys(chinese).sort());
  for (const key of Object.keys(english)) {
    assert.ok(english[key].trim() && chinese[key].trim(), `Empty translation: ${key}`);
    assert.deepEqual(placeholders(english[key]), placeholders(chinese[key]), key);
  }
});

test("literal website translation calls resolve in both languages", () => {
  const missing = [];
  for (const dir of ["app", "components", "hooks"]) {
    const base = path.join(root, dir);
    for (const name of fs.readdirSync(base, { recursive: true })) {
      if (!/\.tsx?$/.test(name)) continue;
      const file = path.join(base, name);
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
      );
      const scan = (node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "t"
        ) {
          const [arg] = node.arguments;
          if (arg && ts.isStringLiteralLike(arg) && arg.text.includes(".")) {
            if (!Object.hasOwn(english, arg.text) || !Object.hasOwn(chinese, arg.text)) {
              const line = source.getLineAndCharacterOfPosition(arg.getStart(source)).line + 1;
              missing.push(`${path.relative(root, file)}:${line}: ${arg.text}`);
            }
          }
        }
        ts.forEachChild(node, scan);
      };
      scan(source);
    }
  }
  assert.deepEqual(missing, []);
});
