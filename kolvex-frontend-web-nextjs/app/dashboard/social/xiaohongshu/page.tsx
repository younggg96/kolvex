import { Metadata } from "next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { XhsPostList } from "@/components/xhs";

export const metadata: Metadata = {
  title: "RedNote - Social Media - Kolvex",
  description: "RedNote posts and analytics",
};

export default function XiaohongshuPage() {
  return (
    <DashboardLayout title="RedNote" showHeader={true}>
      <div className="relative flex-1 flex flex-col min-h-0 bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="relative flex-1 p-2 min-h-0">
          <XhsPostList className="h-full" />
        </div>
      </div>
    </DashboardLayout>
  );
}
