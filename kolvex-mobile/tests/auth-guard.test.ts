import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
const app = new URL("../src/app", import.meta.url).pathname;
const layout = ts.createSourceFile(
  "_layout.tsx",
  readFileSync(join(app, "_layout.tsx"), "utf8"),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
// `Stack.Protected` only covers declared screens: an undeclared route file stays open.
function screens() {
  const found: { name: string; guard: string | null }[] = [];
  function visit(node: ts.Node, guard: string | null) {
    if (ts.isJsxElement(node)) {
      const tag = node.openingElement.tagName.getText(layout);
      if (tag === "Stack.Protected") {
        const attribute = node.openingElement.attributes.properties.find(
          (prop) =>
            ts.isJsxAttribute(prop) && prop.name.getText(layout) === "guard",
        );
        const value = attribute?.getText(layout).replace("guard=", "");
        node.children.forEach((child) => visit(child, value ?? "?"));
        return;
      }
    }
    if (
      ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText(layout) === "Stack.Screen"
    ) {
      const name = node.attributes.properties.find(
        (prop) =>
          ts.isJsxAttribute(prop) && prop.name.getText(layout) === "name",
      );
      found.push({
        name: name!.getText(layout).replace(/^name="|"$/g, ""),
        guard,
      });
    }
    ts.forEachChild(node, (child) => visit(child, guard));
  }
  visit(layout, null);
  return found;
}
function routes(dir = app): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const file = join(dir, entry);
    if (statSync(file).isDirectory())
      return entry.startsWith("(") ? [entry] : routes(file);
    if (!/\.tsx$/.test(entry) || /^(_layout|\+)/.test(entry)) return [];
    return [relative(app, file).replace(/\.tsx$/, "")];
  });
}
const open = ["sign-in", "auth/callback", "auth/recovery"];
test("every app route requires a session except sign-in and auth callbacks", () => {
  const declared = screens();
  const guardOf = new Map(declared.map((item) => [item.name, item.guard]));
  for (const route of routes()) {
    assert.ok(guardOf.has(route), `${route} has no Stack.Screen, so no guard`);
    if (route === "sign-in") assert.equal(guardOf.get(route), "{!session}");
    else if (open.includes(route)) assert.equal(guardOf.get(route), null);
    else assert.equal(guardOf.get(route), "{!!session}", route);
  }
});
test("the navigator waits for the stored session before routing", () => {
  assert.match(layout.text, /if \(!ready\)\s+return/);
});
