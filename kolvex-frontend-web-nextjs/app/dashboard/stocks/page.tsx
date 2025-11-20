import StockPageClient from "@/components/StockPageClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stock Tracker - Kolvex",
  description:
    "Track your favorite stocks and see what KOLs are saying about them",
};

export default function StockTrackerPage() {
  return <StockPageClient />;
}
