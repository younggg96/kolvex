import { Metadata } from "next";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PostList from "@/components/tweet/PostList";

export const metadata: Metadata = {
  title: "Twitter / X - Social Media - Kolvex",
  description: "Twitter/X posts and analytics from KOLs",
};

export default function TwitterPage() {
  return (
    <DashboardLayout title="Twitter / X" showHeader={true}>
      <div className="relative flex-1 flex flex-col min-h-0 bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="relative flex-1 p-2 min-h-0">
          <PostList className="h-full" />
        </div>
      </div>
    </DashboardLayout>
  );
}
