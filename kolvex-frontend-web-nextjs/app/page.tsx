import { Metadata } from "next";
import HomePageClient from "@/components/pages/HomePageClient";

export const metadata: Metadata = {
  title: "Kolvex — Investment Decision Workspace",
  description:
    "Know why you own a stock. Know when that reason changes. Creator opinions, market structure, AI research and your portfolio in one investment decision workspace.",
  keywords: [
    "investment decision workspace",
    "investment thesis",
    "investment account sync",
    "creator stock opinions",
    "stock research",
    "decision journal",
  ],
  openGraph: {
    title: "Kolvex — Investment Decision Workspace",
    description:
      "Creator opinions, market context, AI research and real holdings. Build, track and review your investment thesis.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Kolvex — Investment Decision Workspace",
    description:
      "Creator opinions, market context, AI research and real holdings. Build, track and review your investment thesis.",
  },
  icons: {
    icon: "/icon.svg",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kolvex",
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
