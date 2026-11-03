import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
// React Native Web accepts raw strings under a View; iOS/Android reject them.
// Check the native text-container contract so preview success cannot hide it.
const textOwners = new Set([
  "Text",
  "Copy",
  "SvgText",
  "Button",
  "SwiftButton",
  "SourceLink",
  "Note",
  "NativeTabs.Trigger.Label",
]);
test("native screen markup never places raw text or space expressions under non-text views", () => {
  const violations: string[] = [];
  function scan(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = join(dir, entry.name);
      if (entry.isDirectory()) scan(file);
      else if (file.endsWith(".tsx")) {
        const ast = ts.createSourceFile(
          file,
          readFileSync(file, "utf8"),
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX,
        );
        function visit(node: ts.Node, owner = "") {
          if (ts.isJsxElement(node)) {
            node.children.forEach((child) =>
              visit(child, node.openingElement.tagName.getText(ast)),
            );
            return;
          }
          if (ts.isJsxFragment(node)) {
            node.children.forEach((child) => visit(child, owner));
            return;
          }
          if (
            !textOwners.has(owner) &&
            ((ts.isJsxText(node) && node.text.trim()) ||
              (ts.isJsxExpression(node) &&
                node.expression &&
                ts.isStringLiteral(node.expression)))
          )
            violations.push(
              `${file}:${ast.getLineAndCharacterOfPosition(node.pos).line + 1}`,
            );
          ts.forEachChild(node, (child) => visit(child, owner));
        }
        visit(ast);
      }
    }
  }
  scan(new URL("../src", import.meta.url).pathname);
  assert.deepEqual(violations, []);
});
