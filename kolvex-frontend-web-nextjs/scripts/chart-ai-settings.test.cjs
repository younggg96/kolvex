/** Every chart layout that can ask for a model must mount the model dialog `runAi` opens. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../components/youtube/chart/ChartView.tsx"), "utf8");

test("runAi's model dialog is mounted in the standard and advanced layouts", () => {
  assert.match(source, /setSettingsOpen\(true\)/, "runAi still opens the dialog through settingsOpen");
  assert.match(source, /showAi && !advanced && <Dialog open=\{settingsOpen\}[^\n]*\{aiSettingsDialogContent\}<\/Dialog>/, "standard layout");
  assert.match(source, /showAi && advanced && <aside\b[^>]*>\s*\{aiControls\}/, "advanced layout");
  assert.match(source, /const aiControls = \([\s\S]*?<Dialog open=\{settingsOpen\}[\s\S]*?\{aiSettingsDialogContent\}/, "advanced controls");
});
