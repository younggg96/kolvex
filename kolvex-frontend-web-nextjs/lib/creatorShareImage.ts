import type { CreatorLatestVideo, OpinionSentiment } from "./youtubeOpinionsApi";
import { formatOpinionDate } from "./opinionDates";

export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1440;
const FONT = 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif';
const TOP = 392;
const BOTTOM = 1260;
const LINE_HEIGHT = 46;
const TEXT_WIDTH = 912;

export type ShareFragment = {
  ticker: string;
  sentiment: OpinionSentiment;
  lines: string[];
  continued: boolean;
  y: number;
};
export type CreatorShareDocument = {
  creator: string;
  date: string;
  title: string;
  source: string;
  videoId: string;
  locale: "zh" | "en";
  pages: ShareFragment[][];
};
type MeasureContext = Pick<CanvasRenderingContext2D, "font" | "measureText">;

/** Wrap complete summaries, including Chinese, newlines and long unbroken URLs. */
export function wrapShareText(ctx: MeasureContext, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r\n?/g, "\n").split("\n")) {
    let line = "";
    for (const character of Array.from(paragraph)) {
      if (line && ctx.measureText(line + character).width > width) {
        lines.push(line);
        line = character;
      } else line += character;
    }
    lines.push(line);
  }
  return lines;
}

function clipShareText(ctx: MeasureContext, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  const characters = Array.from(text);
  while (characters.length && ctx.measureText(characters.join("") + "…").width > width) characters.pop();
  return characters.join("") + "…";
}

export function planCreatorShare(data: CreatorLatestVideo, locale: "zh" | "en", ctx: MeasureContext): CreatorShareDocument {
  if (!data.creator || !data.video || !data.opinions.length) throw new Error("No creator opinions");
  const pages: ShareFragment[][] = [[]];
  let y = TOP;
  ctx.font = `400 30px ${FONT}`;
  // Preserve the API's complete video set; do not inherit screen filters or pagination.
  for (const opinion of data.opinions) {
    const text = opinion.summary?.trim() || opinion.thesis?.trim() || opinion.key_points?.join("\n") ||
      (locale === "zh" ? "暂无文字摘要，请查看原视频。" : "No written summary. See the source video.");
    const lines = wrapShareText(ctx, text, TEXT_WIDTH);
    let cursor = 0;
    while (cursor < lines.length) {
      let room = Math.floor((BOTTOM - y - 100) / LINE_HEIGHT);
      if (room < Math.min(2, lines.length - cursor)) {
        pages.push([]);
        y = TOP;
        room = Math.floor((BOTTOM - y - 100) / LINE_HEIGHT);
      }
      const count = Math.min(room, lines.length - cursor);
      pages[pages.length - 1].push({ ticker: opinion.ticker, sentiment: opinion.sentiment,
        lines: lines.slice(cursor, cursor + count), continued: cursor > 0, y });
      y += 100 + count * LINE_HEIGHT;
      cursor += count;
    }
  }
  return {
    creator: data.creator.channel_title || data.creator.channel_handle || data.creator.channel_id,
    date: formatOpinionDate(data.video.opinion_date || data.video.video_published_at, locale === "zh" ? "zh-CN" : "en-US"),
    title: data.video.video_title || (locale === "zh" ? "最新视频观点" : "Latest video opinions"),
    source: /^https:\/\/(www\.)?youtube\.com\//.test(data.video.video_url || "") || /^https:\/\/youtu\.be\//.test(data.video.video_url || "")
      ? data.video.video_url! : /^[\w-]{11}$/.test(data.video.video_id) ? `https://www.youtube.com/watch?v=${data.video.video_id}` : "",
    videoId: data.video.video_id,
    locale, pages,
  };
}

export function drawCreatorSharePage(ctx: CanvasRenderingContext2D, doc: CreatorShareDocument, index: number): void {
  const page = doc.pages[index];
  if (!page) throw new Error("Invalid share page");
  const zh = doc.locale === "zh";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#FAFAF9";
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 366, SHARE_WIDTH, 922);
  const text = (value: string, x: number, y: number, size: number, color = "#000000", weight = 400) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  };
  const rule = (y: number) => { ctx.fillStyle = "#E4E3DF"; ctx.fillRect(72, y, TEXT_WIDTH, 2); };

  // The existing Kolvex candlestick mark, drawn directly to avoid image/CORS failures.
  ctx.save();
  ctx.translate(60, 112);
  ctx.scale(0.075, 0.075);
  ctx.fillStyle = "#00C805";
  ctx.fill(new Path2D("M280-160v-90h-80v-460h80v-90h60v90h80v460h-80v90h-60Zm-20-150h100v-340H260v340Zm360 150v-210h-80v-260h80v-170h60v170h80v260h-80v210h-60Zm-20-270h100v-140H600v140Z"));
  ctx.restore();
  text("KOLVEX", 144, 83, 30, "#000000", 700);
  ctx.textAlign = "right";
  text(zh ? "博主最新观点" : "LATEST CREATOR OPINIONS", 984, 83, 24, "#5C5F63", 500);
  ctx.textAlign = "left";
  rule(128);
  ctx.font = `600 52px ${FONT}`;
  text(clipShareText(ctx, doc.creator, TEXT_WIDTH), 72, 200, 52, "#000000", 600);
  text(`${doc.date}  ·  ${zh ? "美东日期" : "New York date"}`, 72, 247, 24, "#5C5F63");
  ctx.font = `400 26px ${FONT}`;
  const title = wrapShareText(ctx, doc.title, TEXT_WIDTH);
  text(title[0] || "", 72, 300, 26, "#5C5F63");
  if (title[1]) text(title.length > 2 ? clipShareText(ctx, title[1] + "…", TEXT_WIDTH) : title[1], 72, 336, 26, "#5C5F63");

  const labels: Record<OpinionSentiment, string> = zh
    ? { bullish: "看多", bearish: "看空", neutral: "中性", mixed: "分歧" }
    : { bullish: "Bullish", bearish: "Bearish", neutral: "Neutral", mixed: "Mixed" };
  for (const fragment of page) {
    const color = fragment.sentiment === "bullish" ? "#008503" : fragment.sentiment === "bearish" ? "#D63A00" : "#5C5F63";
    text(fragment.ticker + (fragment.continued ? zh ? "（续）" : " (continued)" : ""), 72, fragment.y + 40, 38, "#000000", 600);
    ctx.textAlign = "right";
    text(labels[fragment.sentiment], 984, fragment.y + 38, 26, color, 600);
    ctx.textAlign = "left";
    fragment.lines.forEach((line, i) => text(line, 72, fragment.y + 93 + i * LINE_HEIGHT, 30, "#333638"));
    rule(fragment.y + 100 + fragment.lines.length * LINE_HEIGHT - 22);
  }
  rule(1308);
  ctx.font = `400 21px ${FONT}`;
  text(clipShareText(ctx, doc.source.replace(/^https:\/\/(www\.)?/, ""), 740), 72, 1350, 21, "#5C5F63");
  ctx.textAlign = "right";
  text(`${index + 1} / ${doc.pages.length}`, 984, 1350, 22, "#5C5F63");
  ctx.textAlign = "left";
  text(zh ? "观点摘要 · 完整内容见原视频" : "Opinion summaries · See the source video for full context", 72, 1398, 21, "#5C5F63");
  ctx.textAlign = "right";
  text("kolvex.app", 984, 1398, 21, "#000000", 500);
  ctx.textAlign = "left";
}

export async function renderCreatorSharePage(doc: CreatorShareDocument, index: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SHARE_WIDTH;
  canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  drawCreatorSharePage(ctx, doc, index);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob) resolve(blob);
    else reject(new Error("Image export failed"));
    // Release the backing bitmap once PNG encoding is complete.
    canvas.width = 0;
    canvas.height = 0;
  }, "image/png"));
}

export function creatorShareFilename(doc: CreatorShareDocument, index: number): string {
  const creator = doc.creator.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").slice(0, 60);
  return `Kolvex-${creator}-${doc.videoId.replace(/[^\w-]/g, "")}-${index + 1}.png`;
}
