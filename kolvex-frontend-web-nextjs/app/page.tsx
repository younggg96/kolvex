import { Metadata } from "next";
import HomePageClient from "@/components/pages/HomePageClient";

export const metadata: Metadata = {
  title: "Kolvex - AI-Powered Investment Intelligence",
  description:
    "Track social media KOLs, monitor retail sentiment, and get AI-powered investment analysis across multiple platforms",
  keywords: [
    "stock analysis",
    "investment intelligence",
    "social media tracking",
    "KOL monitoring",
    "AI investment",
  ],
  openGraph: {
    title: "Kolvex - AI-Powered Investment Intelligence",
    description:
      "Track social media KOLs, monitor retail sentiment, and get AI-powered investment analysis",
    type: "website",
  },
};

export default function Home() {
  return <HomePageClient />;
}
