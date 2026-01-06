import DashboardLayout from "@/components/layout/DashboardLayout";
import { AnalyticsDashboard } from "@/components/analytics";

export default function AnalyticsPage() {
  return (
    <DashboardLayout title="Analytics" showHeader={true}>
      <div className="relative flex-1 flex flex-col min-h-0 bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="relative flex-1 p-4 md:p-6 overflow-auto">
          <AnalyticsDashboard />
        </div>
      </div>
    </DashboardLayout>
  );
}

