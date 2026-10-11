import type { CreatorLatestVideo, YouTubeCreatorSummary, YouTubeOpinion } from "./youtubeOpinionsApi";
import { formatOpinionDate } from "./opinionDates";

export type CreatorShareIdentity = Pick<YouTubeCreatorSummary, "channel_id" | "channel_title" | "channel_handle">;
export const CREATOR_SHARE_ORIGIN = "https://kolvex.app";

export function creatorSharePath(channelId: string): string {
  return `/share/creators/${encodeURIComponent(channelId)}`;
}

export function creatorShareUrl(channelId: string): string {
  return CREATOR_SHARE_ORIGIN + creatorSharePath(channelId);
}

export function sourceVideoUrl(video?: Pick<YouTubeOpinion, "video_id" | "video_url"> | null): string {
  if (!video) return "";
  try {
    const parsed = new URL(video.video_url || "");
    if (parsed.protocol === "https:" && !parsed.username && !parsed.password &&
      ["youtube.com", "www.youtube.com", "youtu.be"].includes(parsed.hostname)) return parsed.href;
  } catch { /* Fall back to the verified video id. */ }
  return /^[\w-]{11}$/.test(video.video_id) ? `https://www.youtube.com/watch?v=${video.video_id}` : "";
}

export function creatorShareContent(creator: CreatorShareIdentity, data: CreatorLatestVideo | null, locale: "zh" | "en") {
  const zh = locale === "zh";
  const name = (data?.creator?.channel_title || creator.channel_title || creator.channel_handle || creator.channel_id).replace(/[\r\n]+/g, " ");
  const title = zh ? `${name}的最新观点 · Kolvex` : `${name}'s latest opinions · Kolvex`;
  const url = creatorShareUrl(creator.channel_id);
  const date = data?.video ? formatOpinionDate(data.video.opinion_date || data.video.video_published_at, zh ? "zh-CN" : "en-US") : "";
  const tickers = data?.opinions.map((opinion) => opinion.ticker).join(" · ") || "";
  const headline = Array.from([title, date, tickers].filter(Boolean).join(" · ")).slice(0, 100).join("");
  const labels = zh ? { bullish: "看多", bearish: "看空", neutral: "中性", mixed: "分歧" }
    : { bullish: "Bullish", bearish: "Bearish", neutral: "Neutral", mixed: "Mixed" };
  const summaries = data?.opinions.map((opinion) => `${opinion.ticker} · ${labels[opinion.sentiment]}\n${opinion.summary || opinion.thesis || opinion.key_points?.join("\n") || (zh ? "详情见原视频" : "See the source video")}`) || [];
  const text = [title, date ? `${date} · ${zh ? "美东日期" : "New York date"}` : "", data?.video?.video_title,
    ...summaries, url].filter(Boolean).join("\n\n");
  return { title, headline, text, url };
}

/** Open the platform's composer; publishing remains an explicit user action. */
export function creatorSocialLinks(content: ReturnType<typeof creatorShareContent>) {
  return [
    { name: "X", href: `https://twitter.com/intent/tweet?${new URLSearchParams({ url: content.url, text: content.headline })}` },
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: content.url })}` },
    { name: "WhatsApp", href: `https://api.whatsapp.com/send?${new URLSearchParams({ text: content.headline + "\n" + content.url })}` },
  ];
}

export function creatorEmailLink(content: ReturnType<typeof creatorShareContent>) {
  return `mailto:?subject=${encodeURIComponent(content.title)}&body=${encodeURIComponent(content.headline + "\n" + content.url)}`;
}
