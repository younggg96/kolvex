/**
 * Structural guard for the requirement:
 *   "选中股票都要去到对应的行情页中"
 *   (every selected stock must go to its own quotes page `/dashboard/market/<TICKER>`)
 *
 * This is a source-level audit, not a behavioural test: it asserts that every
 * stock-identity surface routes through `lib/stockLinks.ts` and that no surface
 * regresses to a hand-rolled or non-routable destination.
 *
 * Run with:  node --test scripts/stock-identity-links.test.cjs
 *
 * Dependency-free (node:test + node:assert + fs only), so CI needs no new deps.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

/** Every non-generated `.ts`/`.tsx` file under the given directories. */
function walk(dirs) {
  const out = [];
  const visit = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
    }
  };
  for (const dir of dirs) visit(path.join(ROOT, dir));
  return out;
}

const SOURCES = walk(["app", "components", "lib"]).filter((file) => !file.includes(`${path.sep}__tests__${path.sep}`));
const rel = (file) => path.relative(ROOT, file);
const read = (file) => fs.readFileSync(file, "utf8");
/** 1-based line number of a character offset. */
const lineAt = (text, index) => text.slice(0, index).split("\n").length;

/**
 * Files that legitimately speak the quotes path without rendering a link:
 * Next.js route definitions (they *are* the destination) and the nav
 * active-state helper (it pattern-matches the pathname).
 */
const ROUTE_INFRA = new Set([
  "app/dashboard/market/[ticker]/page.tsx",
  "app/dashboard/research/[ticker]/page.tsx",
  "components/layout/navItems.ts",
  "lib/productFeatures.ts",
  "lib/stockLinks.ts",
]);

test("a stock identity never links to a broken quotes path", () => {
  const offenders = [];
  for (const file of SOURCES) {
    const text = read(file);
    for (const bad of [
      "/dashboard/market/undefined",
      "/dashboard/market/null",
      "/dashboard/market/   ",
      '"`/dashboard/market/`"',
    ]) {
      if (bad.startsWith('"`')) {
        if (text.includes("`/dashboard/market/`")) offenders.push(`${rel(file)} contains an empty quotes path`);
        continue;
      }
      if (text.includes(bad)) offenders.push(`${rel(file)} contains ${bad}`);
    }
  }
  assert.deepEqual(offenders, []);
});

/**
 * Pre-existing hand-rolled quotes hrefs that predate this change and are NOT
 * stock-identity surfaces from the landing/decision UI. They all encode + are
 * correct, but should progressively migrate to `marketStockHref`. Listed so the
 * test alerts on any NEW bypass instead of failing on known debt.
 */
const KNOWN_HAND_ROLLED = new Set([
  "components/decision/Journal.tsx",
  "components/decision/MarketComparison.tsx",
  "components/decision/StockLookup.tsx",
  "components/decision/StockObservationList.tsx",
  "components/decision/Watchlist.tsx",
  "components/youtube/YouTubeOpinionExplorer.tsx",
]);

test("quotes-page hrefs are built by lib/stockLinks, not hand-rolled", () => {
  const offenders = [];
  for (const file of SOURCES) {
    if (ROUTE_INFRA.has(rel(file))) continue;
    const text = read(file);
    // Any template literal that interpolates into /dashboard/market/ bypasses the
    // helper's normalization + encoding + validation rules.
    const pattern = /`\/dashboard\/market\/\$\{/g;
    let match;
    while ((match = pattern.exec(text))) {
      if (KNOWN_HAND_ROLLED.has(rel(file))) continue;
      offenders.push(`${rel(file)}:${lineAt(text, match.index)} hand-rolled quotes href`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("lib/stockLinks is the single source of the /dashboard/market base", () => {
  // Only the helper module itself may declare the literal base path.
  const declared = SOURCES.filter(
    (file) => !ROUTE_INFRA.has(rel(file)) && /(["'`])\/dashboard\/market\1/.test(read(file)),
  ).map(rel);
  assert.deepEqual(declared, []);
});

test("every CompanyLogo surface in app/ and components/ is routable or explicitly exempt", () => {
  // Surfaces where the stock identity is rendered as part of a larger target and
  // therefore must NOT add its own nested link. Keep this list small + justified;
  // each entry is "<file>: <reason>".
  const IS_DESTINATION = new Set([
    "components/decision/StockWorkspace.tsx",
    // The shared logo primitive itself - a leaf visual, never a surface.
    "components/ui/company-logo.tsx",
  ]);
  /**
   * KNOWN GAPS (reported to the Lead, not fixed here): the stock identity is
   * rendered but no surface in the file reaches the quotes page. A nested <Link>
   * would be invalid HTML because the whole row/card is already one link, so the
   * fix has to happen at the parent (e.g. a sibling "quotes" action).
   */
  // No known gaps: every stock identity surface reaches a quotes page.
  const KNOWN_GAP = new Set([]);
  const EXEMPT = new Map([
    [
      "components/youtube/VideoOpinionCard.tsx",
      "row is a <button>; its onStock handler navigates to the quotes page",
    ],
    [
      "components/youtube/OpinionCard.tsx",
      "row is a <button>; its onStock handler navigates to the quotes page / stock tab",
    ],
    [
      "components/youtube/OtherCreatorOpinions.tsx",
      "renders OpinionCard with showTicker={false} - no stock identity",
    ],
    [
      "components/decision/StockWorkspace.tsx",
      "IS the quotes page - no further navigation needed",
    ],
    [
      "components/decision/Watchlist.tsx",
      "logo sits inside the row <Link> that already targets the quotes page",
    ],
    [
      "components/decision/StockObservationList.tsx",
      "logo sits inside the row <Link> that already targets the quotes page",
    ],
    [
      "components/decision/PortfolioChanges.tsx",
      "logo sits inside the row <Link> that already targets the quotes page",
    ],
    [
      "components/decision/MarketWatchlistCard.tsx",
      "logo sits inside the row <Link> that already targets the quotes page",
    ],
    [
      "components/decision/shared.tsx",
      "WorkspaceLink already is the quotes-page <Link> that wraps the logo",
    ],
    [
      "components/public/ReadingDirectories.tsx",
      "logo is inside a card <Link> to the stock's reading page; chip links to quotes",
    ],
    [
      "components/portfolio/PortfolioAIAnalysis.tsx",
      "accordion trigger is a <button>; content carries the quotes link instead",
    ],
  ]);

  const filesWithLogo = SOURCES.filter((file) => /<CompanyLogo[\s>]/.test(read(file))).map(rel);
  assert.ok(filesWithLogo.length > 20, "expected the audit to see the stock surfaces");
  const offenders = [];
  for (const file of filesWithLogo) {
    if (IS_DESTINATION.has(file) || KNOWN_GAP.has(file)) continue;
    const text = read(file);
    const linked =
      /marketStockHref|marketStockUrl|MARKET_STOCK_BASE/.test(text) || /\/dashboard\/market/.test(text);
    if (!linked && !EXEMPT.has(file)) {
      offenders.push(`${file} renders <CompanyLogo> but offers no /dashboard/market route`);
      continue;
    }
    if (EXEMPT.has(file)) {
      // An exemption must still be justified: the file has to reach the quotes page
      // somehow (row link, onStock handler, accordion content link) - otherwise the
      // stock identity there is a dead end.
      if (!/dashboard\/market|marketStockHref|marketStockUrl|onStock|StockQuotesLink/.test(text)) {
        offenders.push(`${file} is EXEMPT but nothing in it reaches /dashboard/market`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test("the landing marquee pills (MU / PLTR / TSLA) are links to the quotes page", () => {
  const text = read(path.join(ROOT, "components/landing/LandingStockTicker.tsx"));
  // Must derive the pill target from the helper, not interpolate a bare string.
  assert.match(text, /marketStockUrl\(stock\.symbol\)/, "landing ticker must resolve pills via marketStockUrl");
  // Non-routable symbols (e.g. an index) degrade to a plain, non-interactive pill.
  assert.match(text, /<Link[\s\S]*?href=\{href\}/, "routable pill must render a <Link>");
  // The marquee animation must survive the change.
  assert.match(text, /animate-ticker/, "ticker marquee animation class was dropped");
  assert.match(text, /hover:\[animation-play-state:paused\]/, "marquee pause-on-hover behaviour was dropped");
});

test("stock identity links keep an accessible name and never open a new tab", () => {
  const offenders = [];
  for (const file of SOURCES) {
    const text = read(file);
    // Icon/logo-only links need an aria-label or visible text; a target=_blank on a
    // quotes link would break the SPA return path.
    if (/<Link[^>]*\bhref=\{marketStockHref/.test(text)) {
      const blocks = text.match(/<Link[^>]*href=\{marketStockHref[^}]*\}[\s\S]{0,400}?<\/Link>/g) || [];
      for (const block of blocks) {
        const hasName = /aria-label=/.test(block) || />[^<]*[A-Za-z\u4e00-\u9fff][\s\S]*</.test(block);
        if (!hasName) offenders.push(`${rel(file)} quotes link without accessible name`);
        if (/target=/.test(block)) offenders.push(`${rel(file)} quotes link must not set target`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});
