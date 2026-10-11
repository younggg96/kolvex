import type { CreatorLatestVideo, OpinionSentiment } from "./youtubeOpinionsApi";
import { formatOpinionDate } from "./opinionDates";
import { sourceVideoUrl } from "./creatorSharing";
import { KOLVEX_LOGO_COLOR, KOLVEX_LOGO_PATH } from "./brandAssets";
import { describeStrength, type StrengthDescription } from "../components/youtube/strength";

export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1440;
const TOP = 392;
const BOTTOM = 1260;
const LINE_HEIGHT = 54;
const TEXT_WIDTH = 912;

export type ShareAppearance = {
  mode: "light" | "dark";
  fontFamily: string;
  radius: number;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  positive: string;
  positiveFill: string;
  negative: string;
  negativeFill: string;
  warning: string;
  inactiveStrength: string;
  neutralStrength: string;
};

/** Snapshot the actual website styles; the export owns no independent palette. */
export function readCreatorShareAppearance(element: HTMLElement): ShareAppearance {
  const style = getComputedStyle(element);
  const color = (token: string, alpha?: number) => {
    const channels = style.getPropertyValue(`--${token}`).trim().split(/\s+/).map(Number);
    if (channels.length !== 3 || channels.some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 255)) {
      throw new Error(`Missing website color token: ${token}`);
    }
    return alpha === undefined ? `rgb(${channels.join(", ")})` : `rgba(${channels.join(", ")}, ${alpha})`;
  };
  return {
    mode: style.colorScheme.includes("dark") ? "dark" : "light",
    fontFamily: style.fontFamily,
    radius: parseFloat(style.borderTopLeftRadius) * 3,
    background: color("background"), foreground: color("foreground"),
    card: color("card"), cardForeground: color("card-foreground"),
    muted: color("muted"), mutedForeground: color("muted-foreground"), border: color("border"),
    positive: color("positive"), positiveFill: color("positive-fill"),
    negative: color("negative"), negativeFill: color("negative-fill"),
    warning: color("warning"), inactiveStrength: color("foreground", 0.15), neutralStrength: color("foreground", 0.75),
  };
}

export type ShareFragment = {
  ticker: string;
  sentiment: OpinionSentiment;
  lines: string[];
  continued: boolean;
  y: number;
  strength: StrengthDescription;
};
export type CreatorShareDocument = {
  creator: string;
  date: string;
  title: string;
  source: string;
  videoId: string;
  locale: "zh" | "en";
  pages: ShareFragment[][];
  appearance: ShareAppearance;
  mixedLabel: string;
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

export function planCreatorShare(data: CreatorLatestVideo, locale: "zh" | "en", ctx: MeasureContext,
  appearance: ShareAppearance, t: (key: string, params?: Record<string, string>) => string): CreatorShareDocument {
  if (!data.creator || !data.video || !data.opinions.length) throw new Error("No creator opinions");
  const pages: ShareFragment[][] = [[]];
  let y = TOP;
  ctx.font = `400 36px ${appearance.fontFamily}`;
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
        lines: lines.slice(cursor, cursor + count), continued: cursor > 0, y,
        strength: describeStrength(opinion.direction_score, { t }) });
      y += 100 + count * LINE_HEIGHT;
      cursor += count;
    }
  }
  return {
    creator: data.creator.channel_title || data.creator.channel_handle || data.creator.channel_id,
    date: formatOpinionDate(data.video.opinion_date || data.video.video_published_at, locale === "zh" ? "zh-CN" : "en-US"),
    title: data.video.video_title || (locale === "zh" ? "最新视频观点" : "Latest video opinions"),
    source: sourceVideoUrl(data.video),
    videoId: data.video.video_id,
    locale, pages, appearance, mixedLabel: t("youtubeOpinions.mixed"),
  };
}

export function drawCreatorSharePage(ctx: CanvasRenderingContext2D, doc: CreatorShareDocument, index: number): void {
  const page = doc.pages[index];
  if (!page) throw new Error("Invalid share page");
  const zh = doc.locale === "zh";
  const appearance = doc.appearance;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = appearance.background;
  ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  ctx.beginPath();
  ctx.roundRect(48, 366, 984, 922, appearance.radius);
  ctx.fillStyle = appearance.card;
  ctx.fill();
  ctx.strokeStyle = appearance.border;
  ctx.lineWidth = 3;
  ctx.stroke();
  const text = (value: string, x: number, y: number, size: number, color = appearance.foreground, weight = 400) => {
    ctx.font = `${weight} ${size}px ${appearance.fontFamily}`;
    ctx.fillStyle = color;
    ctx.fillText(value, x, y);
  };
  const rule = (y: number) => { ctx.fillStyle = appearance.border; ctx.fillRect(84, y, TEXT_WIDTH, 3); };

  // The existing Kolvex candlestick mark, drawn directly to avoid image/CORS failures.
  ctx.save();
  ctx.translate(60, 112);
  ctx.scale(0.075, 0.075);
  ctx.fillStyle = KOLVEX_LOGO_COLOR;
  ctx.fill(new Path2D(KOLVEX_LOGO_PATH));
  ctx.restore();
  text("Kolvex", 144, 91, 51, appearance.foreground, 700);
  ctx.textAlign = "right";
  text(zh ? "博主最新观点" : "Latest creator opinions", 996, 83, 26, appearance.mutedForeground, 500);
  ctx.textAlign = "left";
  rule(128);
  ctx.font = `600 64px ${appearance.fontFamily}`;
  text(clipShareText(ctx, doc.creator, TEXT_WIDTH), 84, 200, 64, appearance.foreground, 600);
  text(`${doc.date}  ·  ${zh ? "美东日期" : "New York date"}`, 84, 247, 28, appearance.mutedForeground);
  ctx.font = `400 26px ${appearance.fontFamily}`;
  const title = wrapShareText(ctx, doc.title, TEXT_WIDTH);
  text(title[0] || "", 84, 300, 26, appearance.mutedForeground);
  if (title[1]) text(title.length > 2 ? clipShareText(ctx, title[1] + "…", TEXT_WIDTH) : title[1], 84, 336, 26, appearance.mutedForeground);
  for (const fragment of page) {
    const color = fragment.strength.tone === "positive" ? appearance.positive : fragment.strength.tone === "negative" ? appearance.negative : appearance.neutralStrength;
    const fill = fragment.strength.tone === "positive" ? appearance.positiveFill : fragment.strength.tone === "negative" ? appearance.negativeFill : appearance.mutedForeground;
    const ticker = fragment.ticker + (fragment.continued ? zh ? "（续）" : " (continued)" : "");
    text(ticker, 84, fragment.y + 40, 38, appearance.cardForeground, 600);
    if (fragment.sentiment === "mixed") text(doc.mixedLabel, 84 + ctx.measureText(ticker).width + 24, fragment.y + 38, 26, appearance.warning, 600);
    ctx.font = `600 30px ${appearance.fontFamily}`;
    const meterX = 996 - ctx.measureText(fragment.strength.label).width - 72;
    for (let step = 1; step <= 3; step++) {
      ctx.fillStyle = step <= fragment.strength.level ? fill : appearance.inactiveStrength;
      ctx.beginPath();
      const height = (4 + step * 3) * 3;
      ctx.roundRect(meterX + (step - 1) * 18, fragment.y + 43 - height, 9, height, 4.5);
      ctx.fill();
    }
    ctx.textAlign = "right";
    text(fragment.strength.label, 996, fragment.y + 38, 30, color, 600);
    ctx.textAlign = "left";
    fragment.lines.forEach((line, i) => text(line, 84, fragment.y + 93 + i * LINE_HEIGHT, 36, appearance.mutedForeground));
    if (fragment !== page[page.length - 1]) rule(fragment.y + 100 + fragment.lines.length * LINE_HEIGHT - 22);
  }
  rule(1308);
  ctx.font = `400 21px ${appearance.fontFamily}`;
  text(clipShareText(ctx, doc.source.replace(/^https:\/\/(www\.)?/, ""), 740), 84, 1350, 21, appearance.mutedForeground);
  ctx.textAlign = "right";
  text(`${index + 1} / ${doc.pages.length}`, 996, 1350, 22, appearance.mutedForeground);
  ctx.textAlign = "left";
  text(zh ? "观点摘要 · 完整内容见原视频" : "Opinion summaries · See the source video for full context", 84, 1398, 21, appearance.mutedForeground);
  ctx.textAlign = "right";
  text("kolvex.app", 996, 1398, 21, appearance.foreground, 500);
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
