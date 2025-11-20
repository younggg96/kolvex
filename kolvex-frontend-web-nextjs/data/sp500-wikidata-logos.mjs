// sp500-wikidata-logos.mjs
// Usage:
//   node sp500-wikidata-logos.mjs [inFile] [outFile] [cacheFile]
// Defaults:
//   inFile   = sp500.constituents.json
//   outFile  = sp500.constituents.wikilogo.json
//   cache    = .wikidata-logo-cache.json
//
// 逻辑：company name -> (Wikidata wbsearchentities 精确/优先匹配) -> QID -> P154 文件名 -> Commons 原图 URL

import fs from "node:fs/promises";

const IN_FILE = process.argv[2] || "sp500.constituents.json";
const OUT_FILE = process.argv[3] || "sp500.constituents.wikilogo.json";
const CACHE_FILE = process.argv[4] || ".wikidata-logo-cache.json";

const UA = {
  "User-Agent": "sp500-wikidata-logo-fetcher/1.0 (contact: you@example.com)",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, tries = 3, baseDelay = 600) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      await sleep(baseDelay * (i + 1));
    }
  }
  throw last;
}

/** 优先用 Wikidata 的实体搜索（更直接）：返回最可能的 QID */
async function wdSearchQidByName(name) {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("search", name);
  url.searchParams.set("language", "en");
  url.searchParams.set("type", "item");
  url.searchParams.set("limit", "3");
  url.searchParams.set("format", "json");
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`wbsearchentities ${res.status}`);
  const json = await res.json();
  if (!json?.search?.length) return null;

  // 1) 优先 exact match（label 或 alias）
  const exact =
    json.search.find(
      (s) => s.match?.type === "label" && s.match.text === name
    ) ||
    json.search.find((s) => s.match?.type === "alias" && s.match.text === name);
  if (exact) return exact.id;

  // 2) 其次优先带 “(company)”/“(American company)” 之类 disambiguation 的
  const companyLike = json.search.find((s) =>
    /\b(company|inc|corp|plc|ltd)\b/i.test(
      (s.description || "") + " " + (s.label || "")
    )
  );
  return (companyLike || json.search[0]).id;
}

/** 退路：从 enwiki 页面标题拿到 QID（若有需要） */
async function wikipediaTitleBySearch(name) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", name);
  url.searchParams.set("srlimit", "1");
  url.searchParams.set("format", "json");
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`wikipedia search ${res.status}`);
  const item = (await res.json())?.query?.search?.[0];
  return item?.title || null;
}
async function wdQidFromWikipediaTitle(title) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "pageprops");
  url.searchParams.set("titles", title);
  url.searchParams.set("format", "json");
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`pageprops ${res.status}`);
  const pages = (await res.json())?.query?.pages || {};
  const first = Object.values(pages)[0];
  return first?.pageprops?.wikibase_item || null;
}

/** QID -> P154 文件名 */
async function wdLogoFileByQid(qid) {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbgetclaims");
  url.searchParams.set("entity", qid);
  url.searchParams.set("property", "P154");
  url.searchParams.set("format", "json");
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`wbgetclaims ${res.status}`);
  const claims = (await res.json())?.claims?.P154;
  if (!claims || !claims.length) return null;

  // 若存在多条，优先 SVG
  const allFiles = claims
    .map((c) => c?.mainsnak?.datavalue?.value)
    .filter(Boolean);
  const svg = allFiles.find((f) => /\.svg$/i.test(f));
  return svg || allFiles[0];
}

/** Commons 文件名 -> 原图 URL */
async function commonsOriginalUrl(fileName) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", `File:${fileName}`);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url");
  url.searchParams.set("format", "json");
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`commons imageinfo ${res.status}`);
  const pages = (await res.json())?.query?.pages || {};
  const first = Object.values(pages)[0];
  return first?.imageinfo?.[0]?.url || null;
}

/** 主流程：公司名 -> (QID) -> P154 -> 原图 URL */
async function getLogoFromWikidata(name) {
  // 先走 Wikidata 实体搜索
  let qid = await withRetry(() => wdSearchQidByName(name));
  if (!qid) {
    // 再退到 enwiki 搜索 -> QID
    const title = await withRetry(() => wikipediaTitleBySearch(name));
    if (title) qid = await withRetry(() => wdQidFromWikipediaTitle(title));
  }
  if (!qid) return { logoUrl: null, _note: "no-qid" };

  const fileName = await withRetry(() => wdLogoFileByQid(qid));
  if (!fileName) return { logoUrl: null, _wikidata: qid, _note: "no-P154" };

  const logoUrl = await withRetry(() => commonsOriginalUrl(fileName));
  return { logoUrl, logoFile: fileName, _wikidata: qid };
}

async function readCache() {
  try {
    return JSON.parse(await fs.readFile(CACHE_FILE, "utf-8"));
  } catch {
    return {};
  }
}
async function writeCache(obj) {
  await fs.writeFile(CACHE_FILE, JSON.stringify(obj, null, 2), "utf-8");
}

async function mapLimited(list, limit, worker) {
  const out = new Array(list.length);
  let i = 0;
  async function runner() {
    while (true) {
      const idx = i++;
      if (idx >= list.length) return;
      try {
        out[idx] = await worker(list[idx], idx);
      } catch (e) {
        out[idx] = { error: e.message };
      }
      await sleep(150); // 轻微节流
    }
  }
  await Promise.all(Array.from({ length: limit }, runner));
  return out;
}

(async () => {
  const cache = await readCache();

  const raw = JSON.parse(await fs.readFile(IN_FILE, "utf-8"));
  const rows = Array.isArray(raw) ? raw : raw.data || raw.items || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error("Input JSON 不符合预期：需要数组。");
    process.exit(1);
  }

  const result = await mapLimited(rows, 6, async (item) => {
    const name = item.name || item.Security || item.company || "";
    if (!name) return { ...item, logoUrl: null, _note: "no-name" };

    if (cache[name]) return { ...item, ...cache[name] };

    const data = await getLogoFromWikidata(name);
    cache[name] = data;
    return { ...item, ...data };
  });

  await writeCache(cache);
  await fs.writeFile(OUT_FILE, JSON.stringify(result, null, 2), "utf-8");
  console.log(`✅ OK: ${result.length} rows → ${OUT_FILE}`);
})();
