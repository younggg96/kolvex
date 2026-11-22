import { CongressTradeList, congressSummary } from "@/components/public/CongressTradeList";
import { ReadingHeading, ReadingText } from "@/components/public/ReadingElements";
import { ReadingSchema } from "@/components/public/ReadingSchema";
import { getPublicCongressTrades } from "@/lib/publicContent";
import { breadcrumbData, readingMetadata } from "@/lib/publicSeo";
import { SITE_URL } from "@/lib/seo";

const DESCRIPTION =
  "美国国会议员按《STOCK Act》披露的最新股票交易：谁、哪天、买入还是卖出哪只股票、金额区间，附披露原文。披露通常滞后交易日数周，无需登录即可阅读。";

export const metadata = readingMetadata(
  "美国国会议员股票交易披露 | Kolvex",
  DESCRIPTION,
  "/congress",
);

export default async function CongressPage() {
  const { trades, synced } = await getPublicCongressTrades();
  const summary = congressSummary(trades);
  const names = (rows: [string, number][]) =>
    rows.map(([name, n]) => `${name}（${n} 笔）`).join("、");
  return (
    <>
      <ReadingSchema data={breadcrumbData([{ name: "国会交易", path: "/congress" }])} />
      <ReadingSchema
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "美国国会议员股票交易披露",
          url: new URL("/congress", SITE_URL).toString(),
          inLanguage: "zh-CN",
          isAccessibleForFree: true,
          publisher: { "@type": "Organization", name: "Kolvex", url: SITE_URL },
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: trades.length,
            itemListElement: trades.map((trade, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: `${trade.member_name} ${trade.direction} ${trade.ticker ?? trade.asset_name ?? ""}`.trim(),
              ...(trade.source_url?.startsWith("https://") ? { url: trade.source_url } : {}),
            })),
          },
        }}
      />
      <ReadingHeading title={<ReadingText en="Congress trades" zh="国会交易" />} />
      {trades.length > 0 ? (
        <>
          <p className="mb-6 max-w-[72ch] text-[0.9375rem] leading-relaxed">
            最新 {summary.total} 条披露中，买入 {summary.buys} 笔、卖出 {summary.sells} 笔
            {summary.newest ? `，最近披露日 ${summary.newest}` : ""}。
            {summary.members.length > 0 && `披露最多的议员：${names(summary.members)}。`}
            {summary.tickers.length > 0 && `涉及最多的股票：${names(summary.tickers)}。`}
          </p>
          <CongressTradeList trades={trades} />
          <p className="mt-6 max-w-[72ch] text-xs leading-relaxed text-muted-foreground">
            <ReadingText
              en="Source: public House and Senate disclosures. Amounts are the ranges filers report, not exact figures. Not investment advice."
              zh="来源：众议院和参议院的公开披露。金额是申报的区间，不是确切数字。不构成投资建议。"
            />
          </p>
        </>
      ) : (
        <p className="py-12 text-muted-foreground">
          {synced ? (
            <ReadingText en="No disclosures are recorded." zh="暂时没有收录的披露。" />
          ) : (
            <ReadingText en="Disclosures have not been imported yet." zh="披露数据还没有导入。" />
          )}
        </p>
      )}
    </>
  );
}
