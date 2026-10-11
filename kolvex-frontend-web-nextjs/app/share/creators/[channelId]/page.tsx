import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicCreatorShareView from "@/components/youtube/PublicCreatorShareView";
import { creatorShareContent } from "@/lib/creatorSharing";
import { getPublicCreatorOpinions } from "./data";

type Props = { params: { channelId: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getPublicCreatorOpinions(params.channelId);
  if (!data.creator || !data.video) return { title: "观点暂不可用 · Kolvex", robots: { index: false, follow: false } };
  const content = creatorShareContent(data.creator, data, "zh");
  const description = data.opinions.map((opinion) => opinion.ticker).join("、") + "的最新股票观点，保留博主、美东日期及原视频来源。";
  return {
    title: content.title, description, alternates: { canonical: content.url },
    openGraph: { title: content.title, description, url: content.url, siteName: "Kolvex", type: "article" },
    twitter: { card: "summary", title: content.title, description },
  };
}

export default async function CreatorSharePage({ params }: Props) {
  const data = await getPublicCreatorOpinions(params.channelId);
  if (!data.creator || !data.video || !data.opinions.length) notFound();
  return <PublicCreatorShareView data={data} />;
}
