import { Metadata } from "next";
import HomePageClient from "@/components/pages/HomePageClient";

export const metadata: Metadata = {
  title: "Kolvex — Stock Information Workspace",
  description:
    "Creator opinions, market data, AI research and holdings. Understand stocks and see the latest changes, ready to read.",
  keywords: [
    "stock information workspace",
    "stock opinion changes",
    "investment account sync",
    "creator stock opinions",
    "stock research",
    "stock updates",
  ],
  openGraph: {
    title: "Kolvex — Stock Information Workspace",
    description:
      "Creator opinions, market context, AI research and real holdings. Read the latest analysis and opinion changes.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Kolvex — Stock Information Workspace",
    description:
      "Creator opinions, market context, AI research and real holdings. Read the latest analysis and opinion changes.",
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
