import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicCreatorShareView from "@/components/youtube/PublicCreatorShareView";
import { creatorShareContent } from "@/lib/creatorSharing";
import { getPublicCreatorOpinions } from "./data";
import { ReadingSchema } from "@/components/public/ReadingSchema";
import { breadcrumbData, readingMetadata } from "@/lib/publicSeo";
import { creatorSharePath } from "@/lib/creatorSharing";

type Props = { params: { channelId: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPublicCreatorOpinions(params.channelId);
  if (!data.creator || !data.video || !data.opinions.length) notFound();
  const content = creatorShareContent(data.creator, data, "zh");
  const tickers = [...new Set(data.opinions.map((opinion) => opinion.ticker))].slice(0, 8).join("、");
  return readingMetadata(content.title, `${tickers}的最新已收录股票观点，保留博主、美东日期及 YouTube 原视频来源，无需登录即可阅读。`, creatorSharePath(params.channelId));
}

export default async function CreatorSharePage({ params }: Props) {
  const data = await getPublicCreatorOpinions(params.channelId);
  if (!data.creator || !data.video || !data.opinions.length) notFound();
  const name = data.creator.channel_title || data.creator.channel_handle || "博主观点";
  return <>
    <ReadingSchema data={breadcrumbData([{ name: "博主观点", path: "/creators" }, { name, path: creatorSharePath(params.channelId) }])} />
    <PublicCreatorShareView data={data} />
  </>;
}
