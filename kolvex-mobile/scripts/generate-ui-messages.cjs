const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const web = path.resolve(
  root,
  "../kolvex-frontend-web-nextjs/lib/i18n/locales",
);
const messages = {};
const normalize = (v) => v.replace(/\s+/g, " ").trim();
function pairs(zh, en) {
  for (const k in zh) {
    if (typeof zh[k] === "string" && typeof en?.[k] === "string")
      messages[normalize(zh[k])] = en[k];
    else if (zh[k] && typeof zh[k] === "object") pairs(zh[k], en?.[k]);
  }
}
pairs(
  JSON.parse(fs.readFileSync(path.join(web, "zh.json"))),
  JSON.parse(fs.readFileSync(path.join(web, "en.json"))),
);
for (const [zh, en] of Object.entries(
  JSON.parse(fs.readFileSync(path.join(root, "translations/native-en.json"))),
))
  messages[normalize(zh)] = en;
const literals = new Set();
const templates = new Set();
function scan(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (/\.tsx?$/.test(file)) {
      const ast = ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      function visit(n) {
        if (ts.isStringLiteral(n) || ts.isJsxText(n)) {
          const value = normalize(n.text);
          if (/[\u4e00-\u9fff]/.test(value)) literals.add(value);
        }
        if (ts.isTemplateExpression(n)) {
          const value = n.templateSpans.reduce(
            (text, span, i) => `${text}{${i}}${span.literal.text}`,
            n.head.text,
          );
          if (/[\u4e00-\u9fff]/.test(value)) templates.add(normalize(value));
        }
        ts.forEachChild(n, visit);
      }
      visit(ast);
    }
  }
}
scan(path.join(root, "src"));
const templateMessages = JSON.parse(
  fs.readFileSync(path.join(root, "translations/templates-en.json")),
);
const missingTemplates = [...templates].filter(
  (value) => !templateMessages[value],
);
const missing = [...literals].filter((v) => !messages[v]);
const selected = Object.fromEntries(
  [...literals]
    .sort()
    .filter((v) => messages[v])
    .map((v) => [v, messages[v]]),
);
if (process.argv.includes("--check")) {
  const existing = JSON.parse(
    fs.readFileSync(path.join(root, "src/lib/uiMessages.json")),
  );
  if (
    missing.length ||
    missingTemplates.length ||
    JSON.stringify(existing) !== JSON.stringify(selected)
  ) {
    console.error("Missing/stale UI translations:", missing, missingTemplates);
    process.exit(1);
  }
} else {
  fs.writeFileSync(
    path.join(root, "src/lib/uiMessages.json"),
    JSON.stringify(selected, null, 2) + "\n",
  );
  fs.writeFileSync(
    "/tmp/kolvex-native-ui-missing.json",
    JSON.stringify(missing, null, 2),
  );
  fs.writeFileSync(
    "/tmp/kolvex-native-ui-templates.json",
    JSON.stringify([...templates], null, 2),
  );
  console.log(
    JSON.stringify(
      {
        messages: Object.keys(selected).length,
        missing,
        templates: [...templates],
      },
      null,
      2,
    ),
  );
}
