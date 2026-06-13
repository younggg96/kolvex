import { Metadata } from "next";
import HomePageClient from "@/components/pages/HomePageClient";

export const metadata: Metadata = {
  title: "Kolvex - Broker Portfolio and AI Trade Review",
  description:
    "Connect Robinhood or Interactive Brokers, sync holdings and trades, review P&L and wash-sale risk, and analyze transactions with your preferred AI model.",
  keywords: [
    "broker portfolio",
    "trade journal",
    "wash sale tracking",
    "options trading history",
    "AI trade review",
    "Robinhood portfolio",
    "Interactive Brokers Flex",
  ],
  openGraph: {
    title: "Kolvex - Broker Portfolio and AI Trade Review",
    description:
      "Sync holdings and trades, review portfolio risk, and improve your investment process with AI.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Kolvex - Broker Portfolio and AI Trade Review",
    description:
      "Sync holdings and trades, review portfolio risk, and improve your investment process with AI.",
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
