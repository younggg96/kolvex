// Read public Xiaohongshu search results with a dedicated, manually signed-in Chrome profile.
// Facts only: note ids, titles, raw times, like counts, and a few hot comments (text + likes).
// No model drives the browser. Captchas and login walls stop the run; they are never bypassed.
import { chmod, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const profile = join(root, "state", "chrome-profile");
const ORIGIN = "https://www.xiaohongshu.com";

// Selectors come from the public web app and may change; a miss is reported, never guessed around.
export const SELECTORS = {
  signedIn: '.side-bar a[href*="/user/profile/"], li.user.side-bar-component',
  loginWall: ".login-container, .login-modal",
  card: "section.note-item",
  cardTitle: ".title span, .title",
  cardAuthor: ".author .name, .name",
  cardTime: ".time",
  cardLikes: ".like-wrapper .count, .count",
  detailReady: "#detail-desc, .note-content",
  detailBody: "#detail-desc",
  detailTime: ".note-content .date, .date",
  commentTotal: ".comments-container .total, .total",
  comment: ".parent-comment",
  commentText: ".note-text",
  commentLikes: ".like .count",
  scroller: ".note-scroller",
};

export const DEFAULTS = {
  keywords: ["美股", "英伟达", "特斯拉", "纳斯达克"],
  scrollsPerKeyword: 4,
  deepReads: 5,
  commentsPerPost: 15,
};

const NOTE_HREF = /\/(?:explore|search_result|discovery\/item)\/([0-9a-zA-Z]{16,32})(?:[/?#]|$)/;

/** Note id and a canonical /explore/ URL from a card link. Keeps xsec_token so the link opens. */
export function parseNoteHref(href) {
  if (typeof href !== "string") return null;
  let url;
  try {
    url = new URL(href, ORIGIN);
  } catch {
    return null;
  }
  if (!/(^|\.)xiaohongshu\.com$/.test(url.hostname)) return null;
  const match = url.pathname.match(NOTE_HREF) || (url.pathname + "/").match(NOTE_HREF);
  if (!match) return null;
  const id = match[1];
  const token = url.searchParams.get("xsec_token");
  const canonical = new URL(`/explore/${id}`, ORIGIN);
  if (token) {
    canonical.searchParams.set("xsec_token", token);
    canonical.searchParams.set("xsec_source", "pc_search");
  }
  return { note_id: id, url: canonical.toString(), has_token: Boolean(token) };
}

/** "1.2万" → 12000, "856" → 856, "赞" / "" → null. Unknown stays null, never 0. */
export function parseCount(text) {
  const value = String(text ?? "").replace(/[,\s+]/g, "");
  const match = value.match(/^(\d+(?:\.\d+)?)(万|w|千|k)?$/i);
  if (!match) return null;
  const scale = { 万: 1e4, w: 1e4, 千: 1e3, k: 1e3 }[match[2]?.toLowerCase() ?? ""] ?? 1;
  return Math.round(Number(match[1]) * scale);
}

/** "共 123 条评论" → 123. */
export function parseCommentTotal(text) {
  const match = String(text ?? "").replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(万)?/);
  return match ? Math.round(Number(match[1]) * (match[2] ? 1e4 : 1)) : null;
}

/** Posts the page labels as minutes or hours old are inside the last 24 hours. */
export function isRecent(raw) {
  return /刚刚|分钟前|小时前/.test(String(raw ?? ""));
}

/** Pick posts to open: recent ones first, then by likes. Only posts with a working link. */
export function pickDeepReads(posts, count) {
  const openable = posts.filter(post => post.has_token);
  const byLikes = (a, b) => (b.likes ?? -1) - (a.likes ?? -1);
  const recent = openable.filter(post => isRecent(post.published_raw)).sort(byLikes);
  const rest = openable.filter(post => !isRecent(post.published_raw)).sort(byLikes);
  return [...recent, ...rest].slice(0, count);
}

const pause = (min, max) => new Promise(resolve => setTimeout(resolve, min + Math.random() * (max - min)));

class Stop extends Error {
  constructor(status, reason) {
    super(reason);
    this.status = status;
    this.reason = reason;
  }
}

async function checkBlocked(page) {
  const url = page.url();
  if (/website-login\/captcha|\/captcha|verify/i.test(url)) throw new Stop("blocked", "captcha");
  if (/\/login(\?|$)|website-login/.test(url)) throw new Stop("login_required", "login_page");
  if (await page.locator(SELECTORS.loginWall).first().isVisible().catch(() => false)) {
    throw new Stop("login_required", "login_wall");
  }
  const text = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  if (/安全验证|请完成验证|访问频繁|操作频繁/.test(text.slice(0, 3000))) throw new Stop("blocked", "security_check");
}

async function openProfile() {
  await mkdir(profile, { recursive: true, mode: 0o700 });
  await chmod(profile, 0o700);
  const { chromium } = await import("playwright-core");
  return chromium.launchPersistentContext(profile, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1280, height: 900 },
    locale: "zh-CN",
  });
}

async function readCards(page) {
  return page.locator(SELECTORS.card).evaluateAll((cards, s) => cards.map(card => {
    const text = selector => card.querySelector(selector)?.textContent?.trim() || null;
    const hrefs = [...card.querySelectorAll("a[href]")].map(a => a.getAttribute("href"));
    return {
      hrefs,
      title: text(s.cardTitle),
      author: text(s.cardAuthor),
      time: text(s.cardTime),
      likes: text(s.cardLikes),
    };
  }), SELECTORS);
}

function mergeCard(posts, card, keyword) {
  const links = card.hrefs.map(parseNoteHref).filter(Boolean);
  const link = links.find(item => item.has_token) || links[0];
  if (!link || !card.title) return false;
  const existing = posts.get(link.note_id);
  if (existing) {
    if (!existing.keywords.includes(keyword)) existing.keywords.push(keyword);
    if (!existing.has_token && link.has_token) Object.assign(existing, { url: link.url, has_token: true });
    return false;
  }
  posts.set(link.note_id, {
    ...link,
    title: card.title,
    author_nickname: card.author,
    published_raw: card.time,
    likes: parseCount(card.likes),
    keywords: [keyword],
  });
  return true;
}

async function sortByLatest(page) {
  try {
    await page.getByText("筛选", { exact: true }).first().hover({ timeout: 5000 });
    await pause(600, 1200);
    await page.getByText("最新", { exact: true }).first().click({ timeout: 5000 });
    await pause(1500, 2500);
    return true;
  } catch {
    return false;
  }
}

async function searchKeyword(page, keyword, posts, options, warnings) {
  const url = new URL("/search_result", ORIGIN);
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("source", "web_search_result_notes");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded" });
  await pause(2500, 4000);
  await checkBlocked(page);
  if (!(await sortByLatest(page))) warnings.add("sort_latest_unavailable");
  let seen = 0;
  for (let index = 0; index <= options.scrollsPerKeyword; index += 1) {
    await checkBlocked(page);
    for (const card of await readCards(page)) {
      seen += 1;
      mergeCard(posts, card, keyword);
    }
    if (index < options.scrollsPerKeyword) {
      await page.mouse.wheel(0, 1600 + Math.random() * 600);
      await pause(2000, 4000);
    }
  }
  if (seen === 0) warnings.add(`no_cards:${keyword}`);
}

async function deepRead(page, post, options) {
  await page.goto(post.url, { waitUntil: "domcontentloaded" });
  await pause(2500, 4000);
  await checkBlocked(page);
  const ready = await page.locator(SELECTORS.detailReady).first()
    .waitFor({ state: "visible", timeout: 15000 }).then(() => true, () => false);
  if (!ready) return null;
  for (let index = 0; index < 2; index += 1) {
    await page.locator(SELECTORS.scroller).first().evaluate(node => node.scrollBy(0, 1200)).catch(() => {});
    await pause(1200, 2200);
  }
  const detail = await page.evaluate(s => {
    const text = selector => document.querySelector(selector)?.textContent?.trim() || null;
    const comments = [...document.querySelectorAll(s.comment)].map(node => ({
      // The commenter's name, avatar and IP location are deliberately never read.
      text: node.querySelector(s.commentText)?.textContent?.trim() || null,
      likes: node.querySelector(s.commentLikes)?.textContent?.trim() || null,
    }));
    return { body: text(s.detailBody), time: text(s.detailTime), total: text(s.commentTotal), comments };
  }, SELECTORS);
  return {
    note_id: post.note_id,
    body: detail.body ? detail.body.slice(0, 3000) : null,
    published_raw: detail.time,
    comments_total: parseCommentTotal(detail.total),
    comments: detail.comments
      .filter(comment => comment.text)
      .slice(0, options.commentsPerPost)
      .map(comment => ({ text: comment.text, likes: parseCount(comment.likes) })),
  };
}

async function signedIn(page, timeout) {
  await page.goto(`${ORIGIN}/explore`, { waitUntil: "domcontentloaded" });
  return page.locator(SELECTORS.signedIn).first()
    .waitFor({ state: "visible", timeout }).then(() => true, () => false);
}

export async function collect(directory, options = DEFAULTS) {
  const warnings = new Set();
  const posts = new Map();
  const deepReads = [];
  const result = { started_at: new Date().toISOString(), keywords: options.keywords };
  const context = await openProfile();
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.setDefaultNavigationTimeout(45000);
    if (!(await signedIn(page, 20000))) {
      await checkBlocked(page);
      throw new Stop("login_required", "not_signed_in");
    }
    for (const keyword of options.keywords) {
      await searchKeyword(page, keyword, posts, options, warnings);
      await pause(3000, 6000);
    }
    for (const post of pickDeepReads([...posts.values()], options.deepReads)) {
      const detail = await deepRead(page, post, options);
      if (detail) deepReads.push(detail);
      else warnings.add("detail_unavailable");
      await pause(3000, 6000);
    }
    result.status = posts.size ? "complete" : "empty";
  } catch (error) {
    if (error instanceof Stop) Object.assign(result, { status: error.status, reason: error.reason });
    else Object.assign(result, { status: "failed", reason: error?.name || "Error" });
  } finally {
    await context.close().catch(() => {});
  }
  Object.assign(result, {
    captured_at: new Date().toISOString(),
    posts: [...posts.values()],
    deep_reads: deepReads,
    warnings: [...warnings],
  });
  await writeFile(join(directory, "raw.json"), JSON.stringify(result, null, 2), { mode: 0o600 });
  return result.status === "complete" ? 0 : 1;
}

export async function login() {
  const context = await openProfile();
  try {
    const page = await context.newPage();
    console.log("请在打开的 Chrome 窗口里登录小红书（建议用小号），15 分钟内完成。");
    const ok = await signedIn(page, 15 * 60000);
    console.log(ok ? "已检测到登录。" : "15 分钟内没有检测到登录，请重新运行 login。");
    return ok ? 0 : 1;
  } finally {
    await context.close().catch(() => {});
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [command, directory, optionsJson] = process.argv.slice(2);
  const run = async () => {
    if (command === "login") return login();
    if (command === "collect" && directory) {
      return collect(directory, { ...DEFAULTS, ...(optionsJson ? JSON.parse(optionsJson) : {}) });
    }
    console.error("usage: collect.mjs login | collect <directory> [options-json]");
    return 2;
  };
  run().then(code => process.exit(code), error => {
    console.error(`浏览器步骤失败（${error?.name || "Error"}）`);
    process.exit(1);
  });
}
