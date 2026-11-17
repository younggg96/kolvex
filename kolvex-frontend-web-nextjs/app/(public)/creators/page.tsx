import { CreatorDirectory } from "@/components/public/ReadingDirectories";
import { notFound, permanentRedirect } from "next/navigation";
import { getPublicOpinions } from "@/lib/publicContent";
import { PUBLIC_PAGE_SIZE, publicPage, publicPagePath, validChannelId } from "@/lib/publicRoutes";
import { readingMetadata } from "@/lib/publicSeo";
import {
  ReadingHeading,
  ReadingText,
  ReadingPagination,
  ReadingSectionHeading,
} from "@/components/public/ReadingElements";

// Also served as `/creators/page/[page]`, which passes the page number in params.
type Props = { params: { page?: string } };

export async function generateMetadata({ params }: Props) {
  const page = publicPage(params.page);
  if (!page) notFound();
  if (params.page === "1") permanentRedirect("/creators");
  const data = await getPublicOpinions();
  const total = (data?.creators || []).filter(
    (item) => validChannelId(item.channel_id) && item.total_opinions > 0,
  ).length;
  if (page > 1 && (page - 1) * PUBLIC_PAGE_SIZE >= total) notFound();
  return readingMetadata(
    `美股博主观点${page > 1 ? ` — 第 ${page} 页` : ""} | Kolvex`,
    "无需登录，阅读财经博主对美股的最新已收录观点。每位博主的股票观点保留美东日期与 YouTube 原视频来源。",
    publicPagePath("/creators", page),
  );
}

export default async function CreatorsPage({ params }: Props) {
  const page = publicPage(params.page);
  if (!page) notFound();
  if (params.page === "1") permanentRedirect("/creators");
  const data = await getPublicOpinions();
  const creators = (data?.creators || []).filter(
    (creator) => validChannelId(creator.channel_id) && creator.total_opinions > 0,
  );
  const offset = (page - 1) * PUBLIC_PAGE_SIZE;
  if (page > 1 && offset >= creators.length) notFound();
  return (
    <>
      <ReadingHeading title={<ReadingText en="Creator opinions" zh="博主观点" />} />
      <ReadingSectionHeading
        title={<ReadingText en="Listed creators" zh="已收录博主" />}
        count={creators.length}
      />
      <CreatorDirectory creators={creators.slice(offset, offset + PUBLIC_PAGE_SIZE)} />
      {!creators.length && (
        <p className="py-12 text-muted-foreground">
          <ReadingText
            en="No creator opinions have been recorded yet."
            zh="暂时没有已收录的博主观点。"
          />
        </p>
      )}
      <ReadingPagination
        page={page}
        total={creators.length}
        size={PUBLIC_PAGE_SIZE}
        path="/creators"
      />
    </>
  );
}
