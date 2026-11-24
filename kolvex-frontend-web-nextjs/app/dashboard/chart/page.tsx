import { Suspense } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ChartTerminal from "@/components/decision/ChartTerminal";

export default function ChartPage() {
  return (
    <DashboardLayout title="看盘 · Chart" noTransition>
      <Suspense fallback={null}>
        <ChartTerminal />
      </Suspense>
    </DashboardLayout>
  );
}
