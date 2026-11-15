import { getPublicOpinions, getPublicResearchList } from "@/lib/publicContent";
import { SITE_URL } from "@/lib/seo";
import { creatorSharePath } from "@/lib/creatorSharing";
import {
  publicResearchPath,
  publicStockPath,
  validChannelId,
  validTicker,
} from "@/lib/publicRoutes";

// Cached like the reading pages; keep in sync with PUBLIC_CONTENT_REVALIDATE_SECONDS.
export const revalidate = 600;

const LIST_LIMIT = 30;
const link = (path: string) => new URL(path, SITE_URL).toString();

/** `/llms.txt`: a plain-text map of the public library for AI assistants, listing only recorded content. */
export async function GET() {
  const [opinions, research] = await Promise.all([
    getPublicOpinions(),
    getPublicResearchList(0, LIST_LIMIT),
  ]);
  const stocks = (opinions?.stocks || [])
    .filter((stock) => validTicker(stock.ticker) && stock.total_opinions > 0)
    .sort((a, b) => b.total_opinions - a.total_opinions)
    .slice(0, LIST_LIMIT);
  const creators = (opinions?.creators || [])
    .filter((creator) => validChannelId(creator.channel_id) && creator.total_opinions > 0)
    .sort((a, b) => b.total_opinions - a.total_opinions)
    .slice(0, LIST_LIMIT);

  const lines = [
    "# Kolvex",
    "",
    "> Kolvex 是面向中文读者的美股研究库：记录财经博主在哪天、对哪只股票、表达了看多/看空/中性的什么观点，每条观点都链接到原始 YouTube 视频；另有标明为 AI 生成的已发布股票研究报告。所有公开页面无需登录。",
    "",
    "引用说明：观点归属于原博主，并以观点日期（美东时间）为准；研究报告为 AI 生成，以其研究日期为分析时点。内容不构成投资建议。",
    "",
    "## 入口",
    "",
    `- [股票目录](${link("/stocks")}): 按股票浏览博主观点与已发布研究`,
    `- [博主观点](${link("/creators")}): 按博主浏览最新已收录观点`,
    `- [股票研究](${link("/research")}): 已发布的 AI 股票研究报告`,
    `- [Sitemap](${link("/sitemap.xml")}): 全部公开页面`,
    "",
    "## 观点最多的股票",
    "",
    ...stocks.map(
      (stock) =>
        `- [${stock.ticker}${stock.company_name ? ` ${stock.company_name}` : ""}](${link(publicStockPath(stock.ticker))}): ${stock.total_opinions} 条观点，看多 ${stock.bullish_count} / 看空 ${stock.bearish_count} / 中性 ${stock.neutral_count}`,
    ),
    "",
    "## 收录观点最多的博主",
    "",
    ...creators.map(
      (creator) =>
        `- [${creator.channel_title || creator.channel_handle || creator.channel_id}](${link(creatorSharePath(creator.channel_id))}): ${creator.total_opinions} 条观点`,
    ),
    "",
    "## 最新研究报告",
    "",
    ...research.items.map(
      (report) =>
        `- [${report.ticker} 股票研究 — ${report.trade_date}](${link(publicResearchPath(report.id))})`,
    ),
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Language": "zh-CN" },
  });
}
