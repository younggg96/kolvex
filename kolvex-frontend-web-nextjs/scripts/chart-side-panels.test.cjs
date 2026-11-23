const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function compile(file) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require, console });
  return module.exports;
}

const panels = compile("lib/chart/sidePanels.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("the default column leads with the watchlist", () => {
  assert.deepEqual(plain(panels.DEFAULT_SIDE_PANELS.open), ["watchlist", "ai"]);
  assert.deepEqual(plain(panels.parseSidePanelLayout(null)), plain(panels.DEFAULT_SIDE_PANELS));
  assert.deepEqual(
    plain(panels.parseSidePanelLayout({ open: "x" })),
    plain(panels.DEFAULT_SIDE_PANELS),
  );
});

test("stored layouts drop unknown and duplicate ids and stray collapsed ids", () => {
  assert.deepEqual(
    plain(
      panels.parseSidePanelLayout({
        open: ["news", "bogus", "news", "earnings"],
        collapsed: ["earnings", "watchlist", 3],
      }),
    ),
    { open: ["news", "earnings"], collapsed: ["earnings"] },
  );
  // A reader who closed every panel keeps an empty column.
  assert.deepEqual(plain(panels.parseSidePanelLayout({ open: [] })), { open: [], collapsed: [] });
});

test("toggling, collapsing and moving keep the layout consistent", () => {
  let layout = panels.DEFAULT_SIDE_PANELS;
  layout = panels.toggleSidePanel(layout, "news");
  assert.deepEqual(plain(layout.open), ["watchlist", "ai", "news"]);
  layout = panels.toggleSidePanelCollapsed(layout, "news");
  assert.deepEqual(plain(layout.collapsed), ["news"]);
  layout = panels.moveSidePanel(layout, "news", -1);
  assert.deepEqual(plain(layout.open), ["watchlist", "news", "ai"]);
  assert.equal(panels.moveSidePanel(layout, "watchlist", -1), layout);
  layout = panels.toggleSidePanel(layout, "news");
  assert.deepEqual(plain(layout), { open: ["watchlist", "ai"], collapsed: [] });
  assert.equal(panels.toggleSidePanelCollapsed(layout, "earnings"), layout);
});

test("panels the chart cannot show are filtered out", () => {
  assert.deepEqual(
    plain(panels.visibleSidePanels({ open: ["ai", "news"], collapsed: [] }, ["watchlist", "news"])),
    ["news"],
  );
});
