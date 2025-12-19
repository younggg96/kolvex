import DashboardLayout from "@/components/layout/DashboardLayout";
import PostList from "@/components/tweet/PostList";

export default function Dashboard() {
  return (
    <DashboardLayout title="Home" showHeader={true}>
      <div className="relative flex-1 flex flex-col min-h-0 bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" />
        <div className="relative flex-1 p-2 min-h-0">
          <PostList className="h-full" />
        </div>
      </div>
    </DashboardLayout>
  );
}
