import { Metadata } from "next";
import HomePageClient from "@/components/pages/HomePageClient";

export const metadata: Metadata = {
  title: "Kolvex - Plaid Portfolio and AI Trade Review",
  description:
    "Connect investment accounts with Plaid, sync holdings and trades, review portfolio risk, and analyze transactions with your preferred AI model.",
  keywords: [
    "broker portfolio",
    "trade journal",
    "investment account sync",
    "options trading history",
    "AI trade review",
    "Plaid Investments",
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
