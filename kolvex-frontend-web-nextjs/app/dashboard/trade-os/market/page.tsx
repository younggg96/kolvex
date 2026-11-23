import { Metadata } from "next";
import { MarketRegimeView } from "@/components/trade-os/market/MarketRegimeView";

export const metadata: Metadata = {
  title: "Market Regime - Trade OS | Kolvex",
  description: "Macro market risk regime monitoring based on SPY and QQQ moving averages.",
};

export default function MarketRegimePage() {
  return <MarketRegimeView />;
}
