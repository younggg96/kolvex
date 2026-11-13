import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PortfolioHoldings from "@/components/portfolio/PortfolioHoldings";

type Props = { params: { userId: string } };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Personal holdings are shared by link only; keep them out of search results.
export const metadata: Metadata = {
  title: "投资组合 | Kolvex",
  robots: { index: false, follow: false },
};

export default function PublicPortfolioPage({ params }: Props) {
  if (!UUID_PATTERN.test(params.userId)) notFound();
  return <PortfolioHoldings userId={params.userId} isOwner={false} />;
}
