import { StockDirectory } from "@/components/public/ReadingDirectories";
import { notFound } from "next/navigation";
import { getPublicOpinions } from "@/lib/publicContent";
import { PUBLIC_PAGE_SIZE, publicPage, publicPagePath, validTicker } from "@/lib/publicRoutes";
import { readingMetadata } from "@/lib/publicSeo";
import { ReadingHeading, ReadingPagination, ReadingSectionHeading } from "@/components/public/ReadingElements";

type Props = { searchParams: { page?: string | string[] } };
export async function generateMetadata({ searchParams }: Props) {
  const page = publicPage(searchParams.page);
  if (!page) notFound();
  const data = await getPublicOpinions();
  const total = (data?.stocks || []).filter((item) => validTicker(item.ticker) && item.total_opinions > 0).length;
  if (page > 1 && (page - 1) * PUBLIC_PAGE_SIZE >= total) notFound();
  return readingMetadata(`美股股票研究目录${page > 1 ? ` — 第 ${page} 页` : ""} | Kolvex`, "按股票浏览财经博主观点和已发布的 AI 股票研究，保留来源与日期，无需登录即可阅读。", publicPagePath("/stocks", page));
}
export default async function StocksPage({ searchParams }: Props) {
  const page = publicPage(searchParams.page);
  if (!page) notFound();
  const data = await getPublicOpinions();
  const stocks = (data?.stocks || []).filter((stock) => validTicker(stock.ticker) && stock.total_opinions > 0);
  const offset = (page - 1) * PUBLIC_PAGE_SIZE;
  if (page > 1 && offset >= stocks.length) notFound();
  return <>
    <ReadingHeading title="股票目录">按股票阅读不同博主的观点，并查看相关的已发布 AI 研究。</ReadingHeading>
    <ReadingSectionHeading title="已收录股票" count={stocks.length} />
    <StockDirectory stocks={stocks.slice(offset, offset + PUBLIC_PAGE_SIZE)} />
    {!stocks.length && <p className="py-12 text-muted-foreground">暂时没有可阅读的股票观点。</p>}
    <ReadingPagination page={page} total={stocks.length} size={PUBLIC_PAGE_SIZE} path="/stocks" />
  </>;
}
