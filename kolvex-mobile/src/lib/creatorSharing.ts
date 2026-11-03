import type { Opinion } from "./models";
import { formatOpinionDate } from "./opinionDates";
export const CREATOR_SHARE_ORIGIN = "https://kolvex.app";
export type CreatorShareIdentity = {
  channel_id: string;
  channel_title?: string;
  channel_handle?: string;
};
export type CreatorLatestVideo = {
  creator?: { channel_title?: string } | null;
  video?: {
    video_id: string;
    video_title?: string;
    video_url?: string;
    opinion_date?: string | null;
    video_published_at?: string | null;
  } | null;
  opinions: Opinion[];
};
export const creatorShareUrl = (channelId: string) =>
  `${CREATOR_SHARE_ORIGIN}/share/creators/${encodeURIComponent(channelId)}`;
export function creatorShareContent(
  creator: CreatorShareIdentity,
  data: CreatorLatestVideo | null,
  locale: "zh" | "en",
) {
  const zh = locale === "zh";
  const name = (
    data?.creator?.channel_title ||
    creator.channel_title ||
    creator.channel_handle ||
    creator.channel_id
  ).replace(/[\r\n]+/g, " ");
  const title = zh
    ? `${name}的最新观点 · Kolvex`
    : `${name}'s latest opinions · Kolvex`;
  const url = creatorShareUrl(creator.channel_id);
  const date = data?.video
    ? formatOpinionDate(
        data.video.opinion_date || data.video.video_published_at,
        zh ? "zh-CN" : "en-US",
      )
    : "";
  const tickers = data?.opinions.map((item) => item.ticker).join(" · ") || "";
  const headline = Array.from(
    [title, date, tickers].filter(Boolean).join(" · "),
  )
    .slice(0, 100)
    .join("");
  const labels = zh
    ? { bullish: "看多", bearish: "看空", neutral: "中性", mixed: "分歧" }
    : {
        bullish: "Bullish",
        bearish: "Bearish",
        neutral: "Neutral",
        mixed: "Mixed",
      };
  const summaries =
    data?.opinions.map(
      (item) =>
        `${item.ticker} · ${labels[item.sentiment]}\n${item.summary || item.thesis || item.key_points?.join("\n") || (zh ? "详情见原视频" : "See the source video")}`,
    ) || [];
  const text = [
    title,
    date ? `${date} · ${zh ? "美东日期" : "New York date"}` : "",
    data?.video?.video_title,
    ...summaries,
    url,
  ]
    .filter(Boolean)
    .join("\n\n");
  return { title, headline, text, url };
}
/** Open the platform's composer; publishing remains an explicit user action. */
export function creatorSocialLinks(
  content: ReturnType<typeof creatorShareContent>,
) {
  const q = (values: Record<string, string>) =>
    Object.entries(values)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
  return [
    {
      name: "X",
      href: `https://twitter.com/intent/tweet?${q({ url: content.url, text: content.headline })}`,
    },
    {
      name: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?${q({ u: content.url })}`,
    },
    {
      name: "WhatsApp",
      href: `https://api.whatsapp.com/send?${q({ text: `${content.headline}\n${content.url}` })}`,
    },
  ];
}
export const creatorEmailLink = (
  content: ReturnType<typeof creatorShareContent>,
) =>
  `mailto:?subject=${encodeURIComponent(content.title)}&body=${encodeURIComponent(`${content.headline}\n${content.url}`)}`;
