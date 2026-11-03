import { Suspense } from "react";
import PaperTradingWorkspace from "@/components/paper-trading/PaperTradingWorkspace";

export const metadata = {
  title: "Paper trading · Kolvex",
  robots: { index: false, follow: false },
};
export default function PaperTradingPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-8">
          Kolvex…
        </p>
      }
    >
      <PaperTradingWorkspace />
    </Suspense>
  );
}
