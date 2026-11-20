import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SharedPage from "@/components/share/SharedPage";
import { shareHeadline, sharePath } from "@/lib/contentShare";
import { readingMetadata } from "@/lib/publicSeo";
import { getPublicShare } from "./data";

type Props = { params: { id: string } };

// Cache rendered share pages (ISR); keep in sync with PUBLIC_CONTENT_REVALIDATE_SECONDS.
// Stopping a share revalidates its path at once.
export const revalidate = 600;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const share = await getPublicShare(params.id);
  if (!share) notFound();
  const zh = share.locale === "zh";
  const description =
    share.card.summary ||
    (zh
      ? "在 Kolvex 查看这条分享，保留来源与日期。"
      : "Read this share on Kolvex, with its source and date.");
  return {
    ...readingMetadata(`${shareHeadline(share, zh)} · Kolvex`, description, sharePath(params.id)),
    // Shares are personal snapshots; they are reachable by link, not listed in search.
    robots: { index: false, follow: true },
  };
}

export default async function SharePage({ params }: Props) {
  const share = await getPublicShare(params.id);
  if (!share) notFound();
  return <SharedPage share={share} />;
}
