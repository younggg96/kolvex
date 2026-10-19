import Link from "next/link";
import CompanyLogo from "@/components/ui/company-logo";
import HeaderBackButton from "@/components/layout/HeaderBackButton";
import { notFound, permanentRedirect } from "next/navigation";
import { getPublicOpinions, getPublicResearchList } from "@/lib/publicContent";
import { PUBLIC_PAGE_SIZE, publicPage, publicPagePath, publicStockPath, validTicker } from "@/lib/publicRoutes";
import { breadcrumbData, readingMetadata } from "@/lib/publicSeo";
import { OpinionList, ReadingHeading, ReadingPagination, ReadingSectionHeading, ResearchList } from "@/components/public/ReadingElements";
import { ReadingSchema } from "@/components/public/ReadingSchema";

type Props = { params: { ticker: string }; searchParams: { page?: string | string[] } };

async function load({ params, searchParams }: Props) {
  const ticker = params.ticker.toUpperCase();
  const page = publicPage(searchParams.page);
  if (!validTicker(ticker) || !page) notFound();
  const path = publicStockPath(ticker);
  if (params.ticker !== ticker) permanentRedirect(publicPagePath(path, page));
  const [opinions, research] = await Promise.all([
    getPublicOpinions(ticker, (page - 1) * PUBLIC_PAGE_SIZE),
    getPublicResearchList(0, PUBLIC_PAGE_SIZE, ticker),
  ]);
  const total = opinions?.pagination?.total ?? opinions?.summary.total_opinions ?? 0;
  if (!total && !research.total) notFound();
  if (page > 1 && (page - 1) * PUBLIC_PAGE_SIZE >= total) notFound();
  return { ticker, page, path, opinions, research, total };
}

export async function generateMetadata(props: Props) {
  const { ticker, page, path } = await load(props);
  return readingMetadata(`${ticker} 股票研究与博主观点${page > 1 ? ` — 第 ${page} 页` : ""} | Kolvex`, `阅读 ${ticker} 的财经博主观点和已发布 AI 股票研究。查看原视频、观点日期和分析证据，无需登录。`, publicPagePath(path, page));
}

export default async function StockReadingPage(props: Props) {
  const { ticker, page, path, opinions, research, total } = await load(props);
  return <>
    <ReadingSchema data={breadcrumbData([{ name: "股票目录", path: "/stocks" }, { name: ticker, path }])} />
    <div className="mb-6"><HeaderBackButton href="/stocks" label="返回股票目录" /></div>
    <ReadingHeading title={`${ticker} 股票研究与博主观点`} icon={<CompanyLogo symbol={ticker} size="lg" />}>阅读不同来源对 {ticker} 的看法。每条观点保留日期和原视频，已发布研究保留其分析时点。</ReadingHeading>
    <div className="grid min-w-0 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0" aria-labelledby="stock-opinions"><ReadingSectionHeading id="stock-opinions" title="博主观点" count={total} />{opinions?.latest.length ? <OpinionList opinions={opinions.latest} /> : <p className="py-8 text-muted-foreground">暂时没有该股票的已收录博主观点。</p>}<ReadingPagination page={page} total={total} size={PUBLIC_PAGE_SIZE} path={path} /></section>
      <aside className="min-w-0 border-t border-border pt-8 lg:border-t-0 lg:pt-0"><ReadingSectionHeading title="已发布研究" count={research.total} />{research.items.length ? <ResearchList items={research.items} layout="stack" /> : <p className="text-sm leading-7 text-muted-foreground">暂时没有该股票的已发布研究。</p>}{research.total > PUBLIC_PAGE_SIZE && <Link href="/research" className="mt-5 inline-block text-sm text-positive underline">浏览全部研究报告</Link>}</aside>
    </div>
  </>;
}
