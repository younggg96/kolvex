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
  twitter: {
    card: "summary",
    title: "Kolvex - AI-Powered Investment Intelligence",
    description:
      "Track social media KOLs, monitor retail sentiment, and get AI-powered investment analysis",
  },
  icons: {
    icon: "/icon.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kolvex AI",
  },
  formatDetection: {
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://kolvex.app",
  },
  category: "finance",
  creator: "Kolvex",
  publisher: "Kolvex",
  authors: {
    name: "Kolvex",
  },
  metadataBase: new URL("https://kolvex.app"),
};

export default function Home() {
  return <HomePageClient />;
}
