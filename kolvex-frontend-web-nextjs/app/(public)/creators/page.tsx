import { CreatorDirectory } from "@/components/public/ReadingDirectories";
import { notFound } from "next/navigation";
import { getPublicOpinions } from "@/lib/publicContent";
import { PUBLIC_PAGE_SIZE, publicPage, publicPagePath, validChannelId } from "@/lib/publicRoutes";
import { readingMetadata } from "@/lib/publicSeo";
import { ReadingHeading, ReadingPagination, ReadingSectionHeading } from "@/components/public/ReadingElements";

type Props = { searchParams: { page?: string | string[] } };

export async function generateMetadata({ searchParams }: Props) {
  const page = publicPage(searchParams.page);
  if (!page) notFound();
  const data = await getPublicOpinions();
  const total = (data?.creators || []).filter((item) => validChannelId(item.channel_id) && item.total_opinions > 0).length;
  if (page > 1 && (page - 1) * PUBLIC_PAGE_SIZE >= total) notFound();
  return readingMetadata(`美股博主观点${page > 1 ? ` — 第 ${page} 页` : ""} | Kolvex`, "无需登录，阅读财经博主对美股的最新已收录观点。每位博主的股票观点保留美东日期与 YouTube 原视频来源。", publicPagePath("/creators", page));
}

export default async function CreatorsPage({ searchParams }: Props) {
  const page = publicPage(searchParams.page);
  if (!page) notFound();
  const data = await getPublicOpinions();
  const creators = (data?.creators || []).filter((creator) => validChannelId(creator.channel_id) && creator.total_opinions > 0);
  const offset = (page - 1) * PUBLIC_PAGE_SIZE;
  if (page > 1 && offset >= creators.length) notFound();
  return <>
    <ReadingHeading title="博主观点">查看财经博主最新一期已收录视频的股票观点。保留原视频与美东日期，方便回到来源核对。</ReadingHeading>
    <ReadingSectionHeading title="已收录博主" count={creators.length} />
    <CreatorDirectory creators={creators.slice(offset, offset + PUBLIC_PAGE_SIZE)} />
    {!creators.length && <p className="py-12 text-muted-foreground">暂时没有已收录的博主观点。</p>}
    <ReadingPagination page={page} total={creators.length} size={PUBLIC_PAGE_SIZE} path="/creators" />
  </>;
}
