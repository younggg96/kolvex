"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import PostList from "@/components/tweet/PostList";

export default function Dashboard() {
  return (
    <DashboardLayout title="Home">
      <div className="h-full flex flex-col p-2">
        <PostList className="flex-1" />
      </div>
    </DashboardLayout>
  );
}
