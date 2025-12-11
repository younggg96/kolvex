import KOLPageClient from "@/components/kol/KOLPageClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KOL Tracker - Kolvex",
  description:
    "Track and manage key opinion leaders across social media platforms",
};

// 强制动态渲染
export const dynamic = "force-dynamic";

export default function KOLTrackerPage() {
  return <KOLPageClient />;
}
