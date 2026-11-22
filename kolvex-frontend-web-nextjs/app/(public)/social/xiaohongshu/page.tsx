import Link from "next/link";
import { ReadingHeading, ReadingText } from "@/components/public/ReadingElements";
import { ReadingSchema } from "@/components/public/ReadingSchema";
import { ListCard, ListRows, listFeedRowClass } from "@/components/ui/list-card";
import { StanceBar, STANCE_TEXT } from "@/components/xhs/XhsDayView";
import { getPublicXhsDays } from "@/lib/publicContent";
import { breadcrumbData, readingMetadata } from "@/lib/publicSeo";
import { countsTotal, dominantStance, negativeCount, stanceLabel } from "@/lib/xhsSentiment";
import { cn } from "@/lib/utils";

export const metadata = readingMetadata(
  "小红书美股情绪日报 | Kolvex",
  "每天整理小红书上美股讨论的情绪分布、热议话题和未证实传言，附出处帖子标题，无需登录。",
  "/social/xiaohongshu",
);

export default async function XiaohongshuIndex() {
  const days = await getPublicXhsDays();
  return (
    <>
      <ReadingSchema
        data={breadcrumbData([
          { name: "社交媒体", path: "/social" },
          { name: "小红书情绪", path: "/social/xiaohongshu" },
        ])}
      />
      <ReadingHeading title={<ReadingText en="Xiaohongshu sentiment" zh="小红书每日情绪" />} />
      {days.length > 0 ? (
        <ListCard>
          <ListRows aria-label="小红书每日情绪">
            {days.map((day) => {
              const counts = day.sentiment.all;
              const total = countsTotal(counts);
              const dominant = dominantStance(counts);
              const negative = total ? Math.round((negativeCount(counts) / total) * 100) : 0;
              return (
                <li key={day.date_pt} className={cn(listFeedRowClass, "min-w-0")}>
                  <Link
                    href={`/social/xiaohongshu/${day.date_pt}`}
                    className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 rounded-sm text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                  >
                    <span className="font-medium tabular-nums">{day.date_pt}</span>
                    <StanceBar counts={counts} />
                    <span className="whitespace-nowrap tabular-nums">
                      <span className={cn("font-medium", dominant && STANCE_TEXT[dominant])}>
                        {dominant ? stanceLabel(dominant, "zh") : "分歧"}
                      </span>{" "}
                      <span className="text-xs text-muted-foreground">
                        恐慌+看空 {negative}% · {total} 条
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ListRows>
        </ListCard>
      ) : (
        <p className="py-12 text-muted-foreground">
          <ReadingText en="No digest has been published yet." zh="还没有发布任何一天的日报。" />
        </p>
      )}
    </>
  );
}
