import { Metadata } from "next";
import { notFound } from "next/navigation";
import SentimentStocksClient from "./SentimentStocksClient";

type SentimentType = "bullish" | "bearish";

const validSentiments: SentimentType[] = ["bullish", "bearish"];

const sentimentMeta: Record<
  SentimentType,
  { title: string; description: string }
> = {
  bullish: {
    title: "Bullish Stocks - Kolvex",
    description: "Stocks with positive sentiment from KOL discussions",
  },
  bearish: {
    title: "Bearish Stocks - Kolvex",
    description: "Stocks with negative sentiment from KOL discussions",
  },
};

interface PageProps {
  params: Promise<{ sentiment: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { sentiment } = await params;
  if (!validSentiments.includes(sentiment as SentimentType)) {
    return { title: "Not Found - Kolvex" };
  }
  return sentimentMeta[sentiment as SentimentType];
}

export default async function SentimentStocksPage({ params }: PageProps) {
  const { sentiment } = await params;

  if (!validSentiments.includes(sentiment as SentimentType)) {
    notFound();
  }

  return (
    <div className="container mx-auto p-4">
      <SentimentStocksClient sentiment={sentiment as SentimentType} />
    </div>
  );
}
