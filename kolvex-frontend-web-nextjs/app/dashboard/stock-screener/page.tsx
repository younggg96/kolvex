import type { Metadata } from "next";
import StockScreenerPageClient from "@/components/stock-screener/StockScreenerPageClient";

export const metadata: Metadata = {
  title: "AI Stock Screener | Kolvex",
  description:
    "AI-powered stock screener with strategy templates and custom filters",
};

export const dynamic = "force-dynamic";

export default function StockScreenerPage() {
  return <StockScreenerPageClient />;
}
