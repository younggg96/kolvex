const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const prettier = require("prettier");
const ts = require("typescript");

const compile = (file) =>
  ts.transpileModule(fs.readFileSync(path.join(__dirname, file), "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      removeComments: true,
    },
  }).outputText;

const js = compile("../lib/featuredInvestors.ts");
const module_ = { exports: {} };
vm.runInNewContext(js, { module: module_, exports: module_.exports });
const {
  featuredHoldings,
  stockReturnPoints,
  stockReturnPath,
  pelosiDisclosures,
  houseDisclosureUrl,
} = module_.exports;

test("featured holdings merge duplicate CUSIPs and retain the full share-only denominator", () => {
  const row = (cusip, value, extra = {}) => ({
    cusip,
    value,
    issuer: cusip,
    share_type: "SH",
    activity: "unchanged",
    ...extra,
  });
  const rows = featuredHoldings([
    row("A", 200),
    row("A", 100, { ticker: "A" }),
    row("B", 100),
    row("C", 100),
    row("D", 100),
    row("E", 100),
    row("F", 100),
    row("OPTION", 5000, { put_call: "Call" }),
    row("PRINCIPAL", 5000, { share_type: "PRN" }),
    row("EXITED", 5000, { activity: "exited" }),
  ]);
  assert.equal(rows.length, 5);
  assert.equal(rows[0].ticker, "A");
  assert.equal(rows[0].weight, 300 / 800);
  assert.equal(rows[1].weight, 100 / 800);
  assert.ok(rows.every(({ cusip }) => cusip.length === 1));
});

test("returns use sorted adjusted closes and a zero baseline within the chosen period", () => {
  const points = stockReturnPoints(
    {
      prices: [
        { date: "2026-11-13", adjusted_close: 110 },
        { date: "2026-10-01", adjusted_close: 100 },
        { date: "2026-10-02", adjusted_close: 0 },
        { date: "2026-06-01", adjusted_close: 80 },
      ],
    },
    "3m",
  );
  assert.equal(points.length, 2);
  assert.equal(points[0].date, "2026-10-01");
  assert.equal(points[0].value, 0);
  assert.ok(Math.abs(points[1].value - 10) < 1e-9);
  assert.equal(stockReturnPoints({ prices: [] }, "6m").length, 0);
  assert.equal(stockReturnPath("BRK.B"), "/market/free-research/BRK-B/stock-returns");
  assert.equal(stockReturnPath("../V"), null);
});

test("Pelosi selections use Nancy's filings by either name order and link only to House originals", () => {
  const matches = pelosiDisclosures([
    { id: 1, member_name: "Jon Pelosi" },
    { id: 2, member_name: "Pelosi, Nancy" },
    { id: 3, member_name: "Nancy Pelosi" },
    { id: 4, member_name: "Nancy Pelosian" },
  ]);
  assert.equal(matches.map(({ id }) => id).join(","), "2,3");
  assert.equal(
    houseDisclosureUrl("https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/123.pdf"),
    "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2026/123.pdf",
  );
  assert.equal(
    houseDisclosureUrl("https://disclosures-clerk.house.gov.evil.example/123.pdf"),
    null,
  );
});

test("Web and App use identical roster, holdings, disclosure and return logic", async () => {
  const normalize = (source) =>
    prettier.format(source, { parser: "babel", objectWrap: "collapse", printWidth: 1000 });
  assert.equal(
    await normalize(compile("../../kolvex-mobile/src/lib/featuredInvestors.ts")),
    await normalize(js),
  );
});
