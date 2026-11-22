import Link from "next/link";
import {
  OpinionList,
  ReadingHeading,
  ReadingSectionHeading,
  ReadingText,
} from "@/components/public/ReadingElements";
import { ReadingSchema } from "@/components/public/ReadingSchema";
import {
  RedditTable,
  Unavailable,
  XSummaryList,
  XhsTeaser,
} from "@/components/public/SocialSections";
import {
  getPublicOpinions,
  getPublicReddit,
  getPublicXSummaries,
  getPublicXhsDay,
  getPublicXhsDays,
} from "@/lib/publicContent";
import { breadcrumbData, readingMetadata } from "@/lib/publicSeo";

const DESCRIPTION =
  "美股社交媒体讨论一页看完：X 博主要点、Reddit 美股热度榜、小红书每日情绪和 YouTube 博主最新观点，每条都标明来源，无需登录。";

export const metadata = readingMetadata(
  "美股社交媒体讨论：X、Reddit、小红书、YouTube | Kolvex",
  DESCRIPTION,
  "/social",
);

/** One failing source must not take down the other three; the section says it is unavailable. */
async function load<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

export default async function SocialPage() {
  const [x, wsb, stocks, xhsDays, youtube] = await Promise.all([
    load(getPublicXSummaries),
    load(() => getPublicReddit("wallstreetbets")),
    load(() => getPublicReddit("all-stocks")),
    load(getPublicXhsDays),
    load(() => getPublicOpinions("", 0, 8)),
  ]);
  const xhsDay = xhsDays?.[0] ? await load(() => getPublicXhsDay(xhsDays[0].date_pt)) : null;
  const names = new Map((x?.creators ?? []).map((c) => [c.username.toLowerCase(), c.display_name]));
  return (
    <>
      <ReadingSchema data={breadcrumbData([{ name: "社交媒体", path: "/social" }])} />
      <ReadingHeading title={<ReadingText en="Social media" zh="社交媒体" />} />

      <section aria-labelledby="social-x" className="mb-10">
        <ReadingSectionHeading
          id="social-x"
          title={<ReadingText en="X creators" zh="X 博主要点" />}
        />
        {x && x.summaries.length > 0 ? (
          <XSummaryList summaries={x.summaries} names={names} />
        ) : (
          <Unavailable en="X summaries are unavailable right now." zh="X 博主要点暂时不可用。" />
        )}
      </section>

      <section aria-labelledby="social-reddit" className="mb-10">
        <ReadingSectionHeading
          id="social-reddit"
          title={<ReadingText en="Reddit heat" zh="Reddit 美股热度榜" />}
        />
        {stocks ? (
          <div className="space-y-4">
            <RedditTable ranking={stocks} limit={15} label="Reddit 全部美股社区热度榜" />
            {wsb && <RedditTable ranking={wsb} limit={10} label="r/wallstreetbets 热度榜" />}
          </div>
        ) : (
          <Unavailable
            en="The Reddit ranking is unavailable right now."
            zh="Reddit 热度榜暂时不可用。"
          />
        )}
      </section>

      <section aria-labelledby="social-xhs" className="mb-10">
        <ReadingSectionHeading
          id="social-xhs"
          title={<ReadingText en="Xiaohongshu sentiment" zh="小红书每日情绪" />}
        />
        {xhsDay ? (
          <XhsTeaser day={xhsDay} />
        ) : (
          <Unavailable en="No Xiaohongshu digest is available yet." zh="暂时没有小红书情绪日报。" />
        )}
        <p className="mt-3 text-sm">
          <Link href="/social/xiaohongshu" className="underline underline-offset-2">
            <ReadingText en="All daily digests" zh="查看全部每日情绪" />
          </Link>
        </p>
      </section>

      <section aria-labelledby="social-youtube" className="mb-10">
        <ReadingSectionHeading
          id="social-youtube"
          title={<ReadingText en="YouTube creators" zh="YouTube 博主最新观点" />}
        />
        {youtube && youtube.latest.length > 0 ? (
          <>
            <OpinionList opinions={youtube.latest.slice(0, 8)} />
            <p className="mt-3 text-sm">
              <Link href="/creators" className="underline underline-offset-2">
                <ReadingText en="All creators" zh="查看全部博主观点" />
              </Link>
            </p>
          </>
        ) : (
          <Unavailable
            en="No creator opinions are available right now."
            zh="博主观点暂时不可用。"
          />
        )}
      </section>
    </>
  );
}
