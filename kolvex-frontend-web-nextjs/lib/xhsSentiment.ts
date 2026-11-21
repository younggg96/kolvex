/** Daily Xiaohongshu sentiment digest (admin-imported, one per Pacific date). */

export const XHS_DAYS_PATH = "/api/xhs-sentiment";
export const xhsDayPath = (date: string) => `/api/xhs-sentiment/${date}`;

/** Bearish to bullish, the order bars and legends always use. */
export const XHS_STANCES = [
  { key: "fear_panic", en: "Fear", zh: "恐慌" },
  { key: "bearish", en: "Bearish", zh: "看空" },
  { key: "neutral", en: "Neutral", zh: "中性" },
  { key: "mixed_cautious_buy", en: "Mixed", zh: "分歧" },
  { key: "bullish", en: "Bullish", zh: "看多" },
] as const;

export type XhsStance = (typeof XHS_STANCES)[number]["key"];
export type XhsCounts = Record<XhsStance, number>;

export interface XhsSource {
  note_id: string;
  url: string;
  title: string;
  author_nickname: string | null;
  published_at: string | null;
  published_raw: string | null;
  comments: number | null;
}

export interface XhsTopic {
  id: string;
  title: string;
  summary: string;
  stance: XhsStance;
  tickers: string[];
  heat: { posts: number; comments: number | null };
  excerpts: { text: string; likes: number | null }[];
  sources: XhsSource[];
}

export interface XhsRumor {
  text: string;
  status: "unverified" | "debunked";
  tickers: string[];
  sources: XhsSource[];
}

export interface XhsSample {
  keywords: string[];
  posts_scanned: number;
  posts_by_keyword: Record<string, number> | null;
  deep_read_posts: number | null;
  comments_read: number | null;
  classified_by: "title" | "body";
  latest_window_hours: number | null;
}

export interface XhsDay {
  date_pt: string;
  captured_at: string;
  sample: XhsSample;
  sentiment: { all: XhsCounts; latest: XhsCounts | null; comments: XhsCounts | null };
  topics: XhsTopic[];
  rumors: XhsRumor[];
  limitations: string[];
}

export interface XhsDaySummary {
  date_pt: string;
  captured_at: string;
  posts_scanned: number;
  classified_by: "title" | "body";
  latest_window_hours: number | null;
  sentiment: { all: XhsCounts; latest: XhsCounts | null };
}

export function stanceLabel(key: XhsStance, locale: "en" | "zh") {
  const stance = XHS_STANCES.find((item) => item.key === key);
  return stance ? stance[locale] : key;
}

export function countsTotal(counts: XhsCounts) {
  return XHS_STANCES.reduce((sum, { key }) => sum + (counts[key] ?? 0), 0);
}

/** Whole-percent shares that always add up to 100 (largest remainder). */
export function stanceShares(counts: XhsCounts): XhsCounts {
  const total = countsTotal(counts);
  const shares = Object.fromEntries(XHS_STANCES.map(({ key }) => [key, 0])) as XhsCounts;
  if (total === 0) return shares;
  const raw = XHS_STANCES.map(({ key }) => ({ key, value: (counts[key] / total) * 100 }));
  raw.forEach(({ key, value }) => (shares[key] = Math.floor(value)));
  let left = 100 - raw.reduce((sum, { key }) => sum + shares[key], 0);
  [...raw]
    .sort((a, b) => b.value - Math.floor(b.value) - (a.value - Math.floor(a.value)))
    .forEach(({ key }) => {
      if (left > 0) {
        shares[key] += 1;
        left -= 1;
      }
    });
  return shares;
}

/**
 * The largest band, stated as a fact ("most posts: bearish"). Ties are reported
 * as no single dominant band instead of picking one.
 */
export function dominantStance(counts: XhsCounts): XhsStance | null {
  const total = countsTotal(counts);
  if (total === 0) return null;
  const top = Math.max(...XHS_STANCES.map(({ key }) => counts[key]));
  const leaders = XHS_STANCES.filter(({ key }) => counts[key] === top);
  return leaders.length === 1 ? leaders[0].key : null;
}

/** Fear and bearish together, the share the page reads as "negative". */
export function negativeCount(counts: XhsCounts) {
  return counts.fear_panic + counts.bearish;
}

/** Previous and next imported dates around `date`, from a newest-first list. */
export function neighbours(days: { date_pt: string }[], date: string) {
  const index = days.findIndex((day) => day.date_pt === date);
  if (index < 0) return { older: null, newer: null };
  return {
    older: days[index + 1]?.date_pt ?? null,
    newer: index > 0 ? days[index - 1].date_pt : null,
  };
}

export function isIsoDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

async function readJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal, cache: "no-store" });
  if (response.status === 404) throw new XhsNotFound();
  if (!response.ok) throw new Error("Xiaohongshu sentiment unavailable");
  return response.json();
}

export class XhsNotFound extends Error {
  constructor() {
    super("No digest for this date");
  }
}

export async function readXhsDays(signal: AbortSignal): Promise<XhsDaySummary[]> {
  const data = await readJson<{ days: XhsDaySummary[] }>(XHS_DAYS_PATH, signal);
  return data.days;
}

export function readXhsDay(date: string) {
  return (signal: AbortSignal) => readJson<XhsDay>(xhsDayPath(date), signal);
}

/** Today's date in Pacific time (`YYYY-MM-DD`), the day a digest is filed under. */
export function todayPt(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const SKELETON = (date: string) => `{
  "schema_version": "xhs-daily.v2",
  "date_pt": "${date}",
  "captured_at": "<采集结束时间，带时区，如 ${date}T19:50:00-08:00>",
  "sample": {
    "keywords": ["美股", "英伟达", "特斯拉", "纳斯达克"],
    "posts_scanned": <整数，等于 sentiment.all 五项之和>,
    "posts_by_keyword": { "美股": <整数> },
    "deep_read_posts": <整数或 null>,
    "comments_read": <整数或 null>,
    "classified_by": "title",
    "latest_window_hours": 24
  },
  "sentiment": {
    "all": { "fear_panic": 0, "bearish": 0, "neutral": 0, "mixed_cautious_buy": 0, "bullish": 0 },
    "latest": { "fear_panic": 0, "bearish": 0, "neutral": 0, "mixed_cautious_buy": 0, "bullish": 0 }
  },
  "topics": [
    {
      "id": "<小写字母数字连字符，如 nvda-selloff>",
      "title": "<话题名，≤40 字>",
      "summary": "<一两句概括，≤200 字>",
      "stance": "<五档之一>",
      "tickers": ["NVDA"],
      "heat": { "posts": <整数>, "comments": <整数或 null> },
      "excerpts": [{ "text": "<评论原话，≤60 字>", "likes": <整数或 null> }],
      "sources": [
        {
          "note_id": "<地址栏里的笔记 ID>",
          "url": "<地址栏完整链接>",
          "title": "<帖子标题原文>",
          "author_nickname": "<发帖人昵称或 null>",
          "published_at": "<带时区的 ISO 时间或 null>",
          "published_raw": "<页面上的时间原文，如 3小时前>",
          "comments": <整数或 null>
        }
      ]
    }
  ],
  "rumors": [{ "text": "<传言，≤100 字>", "status": "unverified", "tickers": [], "sources": [] }],
  "limitations": ["<给读者看的覆盖说明>"]
}`;

const PROMPT_ZH = (
  date: string,
) => `你在帮我整理小红书上美股讨论的每日情绪。请用已登录的浏览器在小红书采集，最后只输出一份 JSON（xhs-daily.v2 格式），不要输出其他文字。

## 采集
1. 依次搜索关键词：美股、英伟达、特斯拉、纳斯达克（可按当天热点增减，实际用过的写进 sample.keywords）。每个关键词按「最新」翻几屏，记录看到的帖子；同一帖子只算一次（按笔记 ID 去重，不按标题）。
2. 按标题判断每条帖子的情绪，归入五档：fear_panic 恐慌、bearish 看空、neutral 中性、mixed_cautious_buy 分歧或谨慎看多、bullish 看多。计数写进 sentiment.all；发布时间在 24 小时内的另计一份写进 sentiment.latest。和美股无关的帖子（买车、FSD 体验等）不计入。
3. 按「最多评论 + 一天内」筛出评论最多的 5 篇，点开读正文和热评，数量写进 sample.deep_read_posts、sample.comments_read。
4. 把当天的讨论归纳成 5–12 个话题（topics）。每个话题写话题名、一两句概括、整体情绪（stance）、涉及的股票代码、热度（涉及帖子数、评论数），附 1–5 条出处帖子和最多 5 条评论原话。
5. 看到未经证实的消息（合并、高管离职、断供等）放进 rumors，status 填 unverified；已被官方否认的填 debunked。已经证实的消息不算传言，写成话题。
6. 把会影响读者理解的局限写进 limitations，例如「特斯拉关键词下多为车型旧帖」「评论为热评抽样」。

## 规则
- 不编造：数字、链接、昵称、时间看不清就填 null，或者不写这一条。不要估算、不要补 0。
- 出处必须可追溯：note_id 和 url 从帖子详情页的浏览器地址栏取，url 原样保留（可以带 xsec_token），必须是 https://www.xiaohongshu.com/… 或 https://xhslink.com/…。没有链接的帖子只计入情绪统计，不能作为出处。
- 时间：published_raw 写页面上的原文（如「3小时前」「昨天 23:50」）；published_at 按采集时间换算成带时区的 ISO 8601，换算不了填 null。captured_at 写采集结束时间。
- 隐私：评论摘录只写原话和点赞数，不写评论人昵称、头像、IP 属地。
- 股票代码用大写美股代码（英伟达 → NVDA，特斯拉 → TSLA，纳指 ETF → QQQ）；拿不准就不写。
- 话题名、概括用简体中文；帖子标题、评论原话保持原文。
- 不要输出 score、占比、情绪标签或任何下面结构里没有的字段，导入会拒绝。

## 输出结构
date_pt 填 ${date}（太平洋时间的采集日期）。尖括号是说明，输出时换成实际值；数组按实际条数填写，不要保留示例里的 0。

${SKELETON(date)}

## 输出前自检
- sample.posts_scanned 等于 sentiment.all 五项之和；sentiment.latest 总数不超过 sentiment.all。
- 每个话题至少 1 条出处，话题 id 不重复，每个出处 url 的路径里包含它的 note_id（xhslink.com 短链除外）。
- 只输出 JSON，可以被 JSON.parse 直接解析。`;

const PROMPT_EN = (
  date: string,
) => `You are compiling a daily sentiment digest of US-stock discussion on Xiaohongshu (RedNote). Use a signed-in browser to collect from Xiaohongshu, then output one JSON document in the xhs-daily.v2 format and nothing else.

## Collect
1. Search these keywords in turn: 美股, 英伟达, 特斯拉, 纳斯达克 (adjust to the day's news; list the ones you used in sample.keywords). For each, sort by newest and scroll a few screens. Count each post once, deduplicated by note ID, not by title.
2. Classify each post by its title into five bands: fear_panic, bearish, neutral, mixed_cautious_buy (mixed or cautious buying), bullish. Put the counts in sentiment.all, and the counts for posts published within 24 hours in sentiment.latest. Leave out posts unrelated to US stocks (car purchases, FSD reviews and so on).
3. Filter by most comments within one day, open the top 5 and read the post and top comments. Record the counts in sample.deep_read_posts and sample.comments_read.
4. Group the day's discussion into 5–12 topics. Each topic has a title, a one- or two-sentence summary, an overall stance, the tickers involved, heat (posts and comments involved), 1–5 source posts and up to 5 verbatim comment excerpts.
5. Put unconfirmed claims (mergers, executive departures, supply cuts and so on) in rumors with status unverified, or debunked if officially denied. Confirmed news is not a rumour; make it a topic.
6. Put anything that limits what readers can conclude in limitations, for example "most Tesla results were old car posts" or "comments are a sample of top comments".

## Rules
- Do not invent anything. If a number, link, nickname or time is unclear, use null or leave the item out. Do not estimate or fill in 0.
- Sources must be traceable: take note_id and url from the post page's address bar and keep the url as it is (it may include xsec_token). It must start with https://www.xiaohongshu.com/ or https://xhslink.com/. A post without a link can count towards sentiment but cannot be a source.
- Times: published_raw is the text shown on the page (such as 3小时前). published_at is that time converted to ISO 8601 with a time zone, using the collection time; use null if you cannot convert it. captured_at is when collection finished.
- Privacy: comment excerpts carry only the text and like count, never the commenter's nickname, avatar or IP location.
- Tickers are upper-case US symbols (英伟达 → NVDA, 特斯拉 → TSLA, Nasdaq ETF → QQQ). Leave a ticker out if unsure.
- Write topic titles and summaries in Simplified Chinese; keep post titles and comment excerpts in their original wording.
- Do not output score, percentages, sentiment labels or any field not in the structure below. The import rejects them.

## Output structure
Set date_pt to ${date} (the collection date in Pacific time). Angle brackets are instructions; replace them with real values. Fill arrays with the actual items and do not keep the example zeros.

${SKELETON(date)}

## Check before output
- sample.posts_scanned equals the sum of sentiment.all; sentiment.latest does not exceed sentiment.all.
- Every topic has at least one source, topic ids are unique, and each source url path contains its note_id (except xhslink.com short links).
- Output only JSON that JSON.parse can read directly.`;

/** The prompt an administrator hands to a browsing assistant to produce one day's JSON. */
export function buildXhsCollectionPrompt(locale: string, date: string): string {
  return locale.toLowerCase().startsWith("zh") ? PROMPT_ZH(date) : PROMPT_EN(date);
}
