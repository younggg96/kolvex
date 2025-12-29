import { Metadata } from "next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PostList from "@/components/tweet/PostList";

export const metadata: Metadata = {
  title: "X / Twitter - Social Media - Kolvex",
  description: "X / Twitter posts and analytics from KOLs",
};

export default function TwitterPage() {
  return (
    <DashboardLayout title="X / Twitter" showHeader={true}>
      <div className="relative flex-1 flex flex-col min-h-0 bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="relative flex-1 p-2 min-h-0">
          <PostList className="h-full" />
        </div>
      </div>
    </DashboardLayout>
  );
}
