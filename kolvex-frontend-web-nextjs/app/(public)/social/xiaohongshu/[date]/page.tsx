import Link from "next/link";
import { notFound } from "next/navigation";
import { ReadingHeading, ReadingText } from "@/components/public/ReadingElements";
import { ReadingSchema } from "@/components/public/ReadingSchema";
import XhsDayView from "@/components/xhs/XhsDayView";
import { getPublicXhsDay, getPublicXhsDays } from "@/lib/publicContent";
import { breadcrumbData, readingMetadata } from "@/lib/publicSeo";
import { SITE_URL } from "@/lib/seo";
import { countsTotal, dominantStance, stanceLabel, type XhsDay } from "@/lib/xhsSentiment";

type Props = { params: { date: string } };

export async function generateStaticParams() {
  try {
    return (await getPublicXhsDays()).map((day) => ({ date: day.date_pt }));
  } catch {
    // An unreachable backend at build time still serves each day on first request.
    return [];
  }
}

function describe(day: XhsDay) {
  const counts = day.sentiment.all;
  const dominant = dominantStance(counts);
  const lean = dominant ? `多数帖子${stanceLabel(dominant, "zh")}` : "情绪没有单一倾向";
  const topics = day.topics
    .slice(0, 3)
    .map((topic) => topic.title)
    .join("；");
  return `${day.date_pt} 小红书美股讨论：共 ${countsTotal(counts)} 条帖子，${lean}。热议话题：${topics}。`;
}

export async function generateMetadata({ params }: Props) {
  const day = await getPublicXhsDay(params.date);
  if (!day) notFound();
  return readingMetadata(
    `${day.date_pt} 小红书美股情绪日报 | Kolvex`,
    describe(day),
    `/social/xiaohongshu/${day.date_pt}`,
  );
}

export default async function XiaohongshuDay({ params }: Props) {
  const day = await getPublicXhsDay(params.date);
  if (!day) notFound();
  const path = `/social/xiaohongshu/${day.date_pt}`;
  return (
    <>
      <ReadingSchema
        data={breadcrumbData([
          { name: "社交媒体", path: "/social" },
          { name: "小红书情绪", path: "/social/xiaohongshu" },
          { name: day.date_pt, path },
        ])}
      />
      <ReadingSchema
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: `${day.date_pt} 小红书美股情绪日报`,
          description: describe(day),
          datePublished: day.captured_at,
          inLanguage: "zh-CN",
          isAccessibleForFree: true,
          url: new URL(path, SITE_URL).toString(),
          author: { "@type": "Organization", name: "Kolvex", url: SITE_URL },
          publisher: { "@type": "Organization", name: "Kolvex", url: SITE_URL },
        }}
      />
      <ReadingHeading title={`${day.date_pt} 小红书美股情绪`} />
      <XhsDayView day={day} />
      <p className="mt-8 text-sm">
        <Link href="/social/xiaohongshu" className="underline underline-offset-2">
          <ReadingText en="All daily digests" zh="查看全部每日情绪" />
        </Link>
      </p>
    </>
  );
}
