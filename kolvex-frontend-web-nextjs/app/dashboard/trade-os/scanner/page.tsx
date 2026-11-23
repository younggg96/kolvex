import { Metadata } from "next";
import { ScannerView } from "@/components/trade-os/scanner/ScannerView";

export const metadata: Metadata = {
  title: "Opportunity Scanner - Trade OS | Kolvex",
  description: "Deterministic stock opportunity scanner for Trend Breakout 20D setups.",
};

export default function ScannerPage() {
  return <ScannerView />;
}
