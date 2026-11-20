/** Share links for any piece of content: types, URLs and the text recipients receive. */

export type ShareKind =
  "chat" | "opinion" | "x_post" | "person_update" | "options_candidate" | "research";

export interface ShareTarget {
  kind: ShareKind;
  sourceId: string;
  /** Chat only: the passage the reader selected. The server checks it is part of the answer. */
  excerpt?: string;
}

export interface ShareAuthor {
  name: string;
  name_en?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
  url?: string | null;
  path?: string | null;
}

export interface ShareSource {
  platform: "youtube" | "x" | "web" | "kolvex";
  url?: string | null;
  path?: string | null;
}

export interface ShareCard {
  v: number;
  title: string;
  summary: string;
  tickers: string[];
  published_at?: string | null;
  author?: ShareAuthor | null;
  source?: ShareSource | null;
  data: Record<string, unknown>;
}

export interface ContentShare {
  id: string;
  kind: ShareKind;
  visibility: "public" | "signed_in";
  locale: "zh" | "en";
  card: ShareCard;
  created_at: string;
  locked: boolean;
}

export interface ShareListItem {
  id: string;
  kind: ShareKind;
  visibility: "public" | "signed_in";
  created_at: string;
  title: string;
  summary: string;
  tickers: string[];
}

export const SHARE_ORIGIN = "https://kolvex.app";
/** Same limit as the backend's MAX_EXCERPT. */
export const MAX_SELECTION_CHARS = 4000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only saved messages (database ids) can be shared; streaming drafts cannot. */
export function isSavedMessageId(id?: string): id is string {
  return Boolean(id && UUID.test(id));
}
const SHARE_ID = /^[A-Za-z0-9]{10}$/;

export function isShareId(value: string): boolean {
  return SHARE_ID.test(value);
}

export function sharePath(id: string): string {
  return `/share/${encodeURIComponent(id)}`;
}

export function shareUrl(id: string, origin: string = SHARE_ORIGIN): string {
  return origin.replace(/\/+$/, "") + sharePath(id);
}

export const SHARE_KIND_LABELS: Record<ShareKind, [en: string, zh: string]> = {
  chat: ["Kolvex AI answer", "Kolvex AI 回答"],
  opinion: ["Creator opinion", "博主观点"],
  x_post: ["X post", "X 博主动态"],
  person_update: ["Key-person update", "人物动态"],
  options_candidate: ["Options activity", "期权异动"],
  research: ["AI research", "AI 研究"],
};

const SENTIMENT: Record<string, [string, string]> = {
  bullish: ["Bullish", "看多"],
  bearish: ["Bearish", "看空"],
  neutral: ["Neutral", "中性"],
  mixed: ["Mixed", "分歧"],
};

const str = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Markdown reduced to readable plain text for chat apps that do not render it. */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^[ \t]*\|?[ \t:|-]+\|[ \t:|-]*(\n|$)/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/(\*\*|__|`)/g, "")
    .replace(/^[ \t]*\|(.*)\|[ \t]*$/gm, (_, row: string) =>
      row
        .split("|")
        .map((cell) => cell.trim())
        .join(" · "),
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clip(text: string, limit: number): string {
  const chars = Array.from(text);
  return chars.length <= limit
    ? text
    : chars
        .slice(0, limit - 1)
        .join("")
        .trimEnd() + "…";
}

/** One line naming what is shared, used as the post title and link-preview headline. */
export function shareHeadline(share: Pick<ContentShare, "kind" | "card">, zh: boolean): string {
  const { card, kind } = share;
  const pick = (pair: [string, string]) => (zh ? pair[1] : pair[0]);
  const data = card.data || {};
  const author = card.author?.name || "";
  const ticker = card.tickers[0] || "";
  switch (kind) {
    case "chat":
      return card.title
        ? `${pick(SHARE_KIND_LABELS.chat)}：${clip(card.title, 60)}`
        : pick(SHARE_KIND_LABELS.chat);
    case "opinion": {
      const sentiment = SENTIMENT[str(data.sentiment)];
      return [author, ticker, sentiment && pick(sentiment)].filter(Boolean).join(" · ");
    }
    case "x_post":
      return [author, card.author?.handle && `@${card.author.handle}`].filter(Boolean).join(" ");
    case "person_update":
      return [author, card.title].filter(Boolean).join("：");
    case "options_candidate":
      // The server-built title names the contract and survives the signed-out teaser.
      return [pick(SHARE_KIND_LABELS.options_candidate), card.title || ticker]
        .filter(Boolean)
        .join(" · ");
    case "research":
      return `${ticker} · ${pick(SHARE_KIND_LABELS.research)}`;
  }
}

/** The main text of the share, in the source's own words. */
export function shareBody(share: Pick<ContentShare, "kind" | "card">, zh: boolean): string {
  const { card, kind } = share;
  const data = card.data || {};
  switch (kind) {
    case "chat": {
      const question = str(data.question);
      const answer = markdownToText(str(data.answer));
      return [question && (zh ? `问：${question}` : `Q: ${question}`), answer]
        .filter(Boolean)
        .join("\n\n");
    }
    case "opinion":
      return str(data.summary) || str(data.thesis);
    case "x_post": {
      const summary = (data.ai_summary as Record<string, string> | null)?.[zh ? "zh" : "en"];
      return [str(data.text), summary && (zh ? `AI 摘要：${summary}` : `AI summary: ${summary}`)]
        .filter(Boolean)
        .join("\n\n");
    }
    case "person_update":
      return str(data.summary);
    case "options_candidate":
      return str(zh ? data.thesis_zh : data.thesis_en);
    case "research":
      return markdownToText(str(data.plan));
  }
}

export function shareSourceUrl(card: ShareCard, origin: string = SHARE_ORIGIN): string {
  if (card.source?.url) return card.source.url;
  if (card.source?.path) return origin.replace(/\/+$/, "") + card.source.path;
  return "";
}

/** Text for pasting into WeChat, Xiaohongshu, Telegram… Long bodies are clipped. */
export function shareText(share: ContentShare, zh: boolean, url: string): string {
  if (share.locked) return [shareHeadline(share, zh), url].join("\n\n");
  const source = shareSourceUrl(share.card);
  return [
    shareHeadline(share, zh),
    clip(shareBody(share, zh), 900),
    source && `${zh ? "原始来源" : "Source"}：${source}`,
    `${zh ? "在 Kolvex 查看" : "View on Kolvex"}：${url}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Composer links; publishing stays an explicit action in the other app. */
export function shareSocialLinks(url: string, headline: string) {
  const text = clip(headline, 100);
  return [
    { name: "X", href: `https://twitter.com/intent/tweet?${new URLSearchParams({ url, text })}` },
    {
      name: "微博",
      nameEn: "Weibo",
      href: `https://service.weibo.com/share/share.php?${new URLSearchParams({ url, title: text })}`,
    },
    { name: "Telegram", href: `https://t.me/share/url?${new URLSearchParams({ url, text })}` },
    {
      name: "WhatsApp",
      href: `https://api.whatsapp.com/send?${new URLSearchParams({ text: `${text}\n${url}` })}`,
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}`,
    },
  ];
}

export function shareEmailLink(headline: string, text: string): string {
  return `mailto:?subject=${encodeURIComponent(headline)}&body=${encodeURIComponent(text)}`;
}
