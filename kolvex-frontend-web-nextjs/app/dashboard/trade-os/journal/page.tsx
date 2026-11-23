import { Metadata } from "next";
import { JournalView } from "@/components/trade-os/journal/JournalView";

export const metadata: Metadata = {
  title: "Trade Journal - Trade OS | Kolvex",
  description: "Trade Journal, R-Multiple tracking, and post-trade discipline review.",
};

export default function TradeOsJournalPage() {
  return <JournalView />;
}
