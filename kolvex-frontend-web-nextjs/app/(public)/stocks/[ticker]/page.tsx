import Link from "next/link";
import CompanyLogo from "@/components/ui/company-logo";
import HeaderBackButton from "@/components/layout/HeaderBackButton";
import { notFound, permanentRedirect } from "next/navigation";
import { getPublicOpinions, getPublicResearchList } from "@/lib/publicContent";
import {
  PUBLIC_PAGE_SIZE,
  publicPage,
  publicPagePath,
  publicStockPath,
  validTicker,
} from "@/lib/publicRoutes";
import {
  breadcrumbData,
  opinionCollectionData,
  readingMetadata,
  stockOpinionSummary,
} from "@/lib/publicSeo";
import { marketStockHref } from "@/lib/stockLinks";
import {
  OpinionList,
  ReadingHeading,
  ReadingPagination,
  ReadingSectionHeading,
  ResearchList,
} from "@/components/public/ReadingElements";
import { ReadingSchema } from "@/components/public/ReadingSchema";

// Also served as `/stocks/[ticker]/page/[page]`, which passes the page number in params.
type Props = { params: { ticker: string; page?: string } };

// Render each ticker on first visit, then serve it from the ISR cache.
export async function generateStaticParams() {
  return [];
}

async function load({ params }: Props) {
  const ticker = params.ticker.toUpperCase();
  const page = publicPage(params.page);
  if (!validTicker(ticker) || !page) notFound();
  const path = publicStockPath(ticker);
  if (params.ticker !== ticker || params.page === "1")
    permanentRedirect(publicPagePath(path, page));
  const [opinions, research] = await Promise.all([
    getPublicOpinions(ticker, (page - 1) * PUBLIC_PAGE_SIZE),
    getPublicResearchList(0, PUBLIC_PAGE_SIZE, ticker),
  ]);
  const total = opinions?.pagination?.total ?? opinions?.summary.total_opinions ?? 0;
  if (!total && !research.total) notFound();
  if (page > 1 && (page - 1) * PUBLIC_PAGE_SIZE >= total) notFound();
  const companyName =
    opinions?.latest.find((opinion) => opinion.company_name)?.company_name ?? null;
  // Data-backed answer paragraph for readers and AI search; latest is only meaningful on page 1.
  const summary = stockOpinionSummary(
    ticker,
    opinions?.summary,
    page === 1 ? opinions?.latest[0] : null,
    research.total,
  );
  return { ticker, page, path, opinions, research, total, companyName, summary };
}

export async function generateMetadata(props: Props) {
  const { ticker, page, path, summary } = await load(props);
  return readingMetadata(
    `${ticker} 股票研究与博主观点${page > 1 ? ` — 第 ${page} 页` : ""} | Kolvex`,
    summary ??
      `阅读 ${ticker} 的财经博主观点和已发布 AI 股票研究。查看原视频、观点日期和分析证据，无需登录。`,
    publicPagePath(path, page),
  );
}

export default async function StockReadingPage(props: Props) {
  const { ticker, page, path, opinions, research, total, companyName, summary } = await load(props);
  return (
    <>
      <ReadingSchema
        data={breadcrumbData([
          { name: "股票目录", path: "/stocks" },
          { name: ticker, path },
        ])}
      />
      <ReadingSchema
        data={opinionCollectionData(
          `${ticker} 股票研究与博主观点`,
          publicPagePath(path, page),
          opinions?.latest ?? [],
          {
            "@type": "Corporation",
            tickerSymbol: ticker,
            ...(companyName ? { name: companyName } : {}),
          },
        )}
      />
      <div className="mb-6">
        <HeaderBackButton href="/stocks" label="返回股票目录" />
      </div>
      {/* The stock identity is the quotes-page shortcut: logo + ticker chip open `/dashboard/market/<TICKER>`. */}
      <ReadingHeading
        title={`${ticker} 股票研究与博主观点`}
        icon={
          <Link
            href={marketStockHref(ticker)}
            aria-label={`打开 ${ticker} 行情页`}
            className="shrink-0 rounded-full transition-opacity duration-150 hover:opacity-80 focus-visible:outline-none "
          >
            <CompanyLogo symbol={ticker} size="lg" />
          </Link>
        }
      >
        {summary ??
          `阅读不同来源对 ${ticker} 的看法。每条观点保留日期和原视频，已发布研究保留其分析时点。`}
      </ReadingHeading>
      <div className="grid min-w-0 gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0" aria-labelledby="stock-opinions">
          <ReadingSectionHeading id="stock-opinions" title="博主观点" count={total} />
          {opinions?.latest.length ? (
            <OpinionList opinions={opinions.latest} />
          ) : (
            <p className="py-8 text-muted-foreground">暂时没有该股票的已收录博主观点。</p>
          )}
          <ReadingPagination page={page} total={total} size={PUBLIC_PAGE_SIZE} path={path} />
        </section>
        <aside className="min-w-0 border-t border-border pt-8 lg:border-t-0 lg:pt-0">
          <ReadingSectionHeading title="已发布研究" count={research.total} />
          {research.items.length ? (
            <ResearchList items={research.items} layout="stack" />
          ) : (
            <p className="text-sm leading-7 text-muted-foreground">暂时没有该股票的已发布研究。</p>
          )}
          {research.total > PUBLIC_PAGE_SIZE && (
            <Link href="/research" className="mt-5 inline-block text-sm text-positive underline">
              浏览全部研究报告
            </Link>
          )}
        </aside>
      </div>
    </>
  );
}
