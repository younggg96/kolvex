/**
 * Regression guard for the X creator posts feed ( `/dashboard/x-opinions` ):
 *
 *   "不应该出现后面的 filter icon button，应该点击个股 icon button 就进入
 *    对应的股票行情 page"
 *
 * The ticker chip under a post (logo + ticker) used to be a non-interactive
 * pill with a *second*, separate funnel-icon button beside it that re-filtered
 * the feed by that ticker. That split made the stock identity a dead end and
 * put an ambiguous "filter" affordance right next to it. The chip itself must
 * now be the link to `/dashboard/market/<TICKER>`, and no funnel button may
 * come back.
 *
 * Run with:  node --test scripts/x-cashtag-quotes-links.test.cjs
 *
 * Source-level audit, dependency-free (node:test + node:assert + fs), matching
 * the rest of `scripts/*.test.cjs` — no Next/React import, no JSX parser.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const FILE = path.join(ROOT, "components/x/XContentExplorer.tsx");
const read = (file) => fs.readFileSync(file, "utf8");

const source = read(FILE);
/** Strip `//` line comments so assertions see markup, not prose about markup. */
const stripComments = (text) =>
  text
    .split("\n")
    .map((line) => line.replace(/^\s*\/\/.*$/, ""))
    .join("\n");
/** The cashtag chip block inside a post's <article>. */
const cashtagBlock = (() => {
  const start = source.indexOf("{post.cashtags.length > 0 && (");
  assert.ok(start > 0, "expected a post.cashtags rendering block");
  const next = source.indexOf("{post.media_links.length > 0 && (", start);
  return stripComments(source.slice(start, next > start ? next : source.length));
})();

test("a post's ticker chip links to that stock's quotes page", () => {
  assert.match(cashtagBlock, /marketStockHref\(tag\)/, "chip must resolve its target via lib/stockLinks");
  assert.match(cashtagBlock, /<Link\b/, "chip must be a link, not a static pill");
  assert.match(
    cashtagBlock,
    /<Link[\s\S]*?href=\{quotesHref\}/,
    "the <Link> must point at the resolved quotes href",
  );
});

test("the chip renders one stock identity, not a pill plus a trailing action", () => {
  assert.match(cashtagBlock, /<StockBadge symbol=\{tag\} href=\{null\}/, "the chip keeps the shared stock-identity pill");
  // The pill is non-interactive (`href={null}`) so the <Link> around it is the only target.
  assert.ok(!/href=\{href\(\{ ticker: tag \}\)\}/.test(cashtagBlock), "chip must not re-filter the feed");
  assert.equal((cashtagBlock.match(/<Link\b/g) || []).length, 1, "one chip = one link");
});

test("no filter-icon button sits beside the stock chip", () => {
  const markup = stripComments(source);
  // The removed affordance was a sibling <button>/<Link> carrying the funnel icon.
  assert.ok(!/FilterIcon|<Filter\b|lucide-react[\s\S]{0,200}\bFilter\b/.test(cashtagBlock), "the trailing funnel action must not come back");
  assert.ok(!/\bFilter className/.test(markup), "XContentExplorer must not render the funnel icon anymore");
  assert.ok(!/Filter X posts by/.test(markup), "the per-post ticker-filter copy must be gone");
  assert.ok(
    !/import \{[^}]*\bFilter\b[^}]*\} from "lucide-react"/.test(markup),
    "an unused Filter icon import would fail lint",
  );
});

test("the chip keeps an accessible name and never opens a new tab", () => {
  assert.match(cashtagBlock, /aria-label=\{c\(`Open \$\{tag\} quotes`/, "icon+dense chip needs an explicit accessible name");
  assert.ok(!/target=/.test(cashtagBlock), "a quotes link must not open a new tab");
  assert.ok(!/href="#"/.test(cashtagBlock), "no dead links");
});

test("the ticker search filter stays available in the feed toolbar", () => {
  // Removing the per-post funnel must not remove the feed's own filtering UI.
  assert.match(source, /id="x-ticker"/, "ticker search input must remain");
  assert.match(source, /href\(\{ ticker: value \}\)/, "submitting the ticker search must still filter the feed");
});
