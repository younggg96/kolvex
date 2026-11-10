import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { MODEL_CONFIGS } from "../src/lib/aiModels";
const web = new URL("../../kolvex-frontend-web-nextjs/", import.meta.url);
const native = new URL("../src/lib/", import.meta.url);
function ast(url: URL) {
  return ts.createSourceFile(
    url.pathname,
    readFileSync(url, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
}
function canonical(node: ts.Node): unknown {
  if (ts.isParenthesizedExpression(node)) return canonical(node.expression);
  if (ts.isParenthesizedTypeNode(node)) return canonical(node.type);
  const children: unknown[] = [];
  ts.forEachChild(node, (child) => {
    children.push(canonical(child));
  });
  return {
    kind: node.kind,
    text:
      ts.isIdentifier(node) ||
      ts.isStringLiteral(node) ||
      ts.isNumericLiteral(node)
        ? node.text
        : undefined,
    children,
  };
}
test("native model choices track the current Web model catalogue", () => {
  const source = ast(new URL("lib/aiModels.ts", web));
  let list: ts.ArrayLiteralExpression | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === "MODEL_CONFIGS" &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    )
      list = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(list);
  const models = list.elements.map((element) => {
    assert.ok(ts.isObjectLiteralExpression(element));
    return Object.fromEntries(
      element.properties.map((prop) => {
        assert.ok(ts.isPropertyAssignment(prop));
        const key = ts.isStringLiteral(prop.name)
          ? prop.name.text
          : prop.name.getText(source);
        const value = prop.initializer;
        assert.ok(
          ts.isStringLiteral(value) ||
            value.kind === ts.SyntaxKind.TrueKeyword ||
            value.kind === ts.SyntaxKind.FalseKeyword,
        );
        return [
          key,
          ts.isStringLiteral(value)
            ? value.text
            : value.kind === ts.SyntaxKind.TrueKeyword,
        ];
      }),
    );
  });
  assert.deepEqual(MODEL_CONFIGS, models);
});
for (const file of [
  "marketBenchmarks.ts",
  "marketObservations.ts",
  "marketComparison.ts",
  "freeResearch.ts",
  "opinionDates.ts",
  "optionsActivity.ts",
  "paperTradingReviews.ts",
  "stockPaperTrading.ts",
]) {
  test(`native ${file} retains Web catalogue/range semantics`, () => {
    assert.deepEqual(
      canonical(ast(new URL(file, native))),
      canonical(ast(new URL(`lib/${file}`, web))),
    );
  });
}
test("native indicator formulas retain the Web financial calculations", () => {
  const source = ast(new URL("components/youtube/chart/indicators.ts", web));
  const client = ast(new URL("technicalIndicators.ts", native));
  const functions = (file: ts.SourceFile) =>
    new Map(
      file.statements
        .filter(ts.isFunctionDeclaration)
        .map((fn) => [fn.name?.text, canonical(fn)]),
    );
  const expected = functions(source),
    actual = functions(client);
  for (const key of ["ema", "vwap", "bollinger", "rsi", "macd", "kdj"])
    assert.deepEqual(actual.get(key), expected.get(key), key);
});
for (const [file, names] of [
  ["economicIndicators.ts", ["indicatorPeriod", "indicatorValue"]],
  ["marketEvents.ts", ["eventTime", "EVENT_CATEGORIES"]],
] as const) {
  test(`${file} formatting matches the Web`, () => {
    const find = (url: URL) => {
      const found = new Map<string, unknown>();
      ts.forEachChild(ast(url), (node) => {
        if (ts.isFunctionDeclaration(node) && node.name)
          found.set(node.name.text, canonical(node));
        if (ts.isVariableStatement(node))
          for (const item of node.declarationList.declarations)
            found.set(item.name.getText(), canonical(item));
      });
      return found;
    };
    const fromWeb = find(new URL(`lib/${file}`, web));
    const fromNative = find(new URL(file, native));
    for (const name of names) {
      assert.ok(fromWeb.has(name), name);
      assert.deepEqual(fromNative.get(name), fromWeb.get(name), name);
    }
  });
}
