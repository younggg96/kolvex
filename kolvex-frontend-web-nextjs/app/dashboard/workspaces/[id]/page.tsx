"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageBreadcrumb from "@/components/layout/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopy } from "@/components/decision/shared";
import { WorkspacePanel } from "@/components/chat/workspace/WorkspacePanel";
import { useResearchWorkspace } from "@/components/chat/workspace/useChatWorkspace";

export default function WorkspacePage() {
  const c = useCopy();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const workspace = useResearchWorkspace({ workspaceId: id });
  const title = workspace.detail?.title;

  return (
    <DashboardLayout
      title={title || c("Workspace", "工作区")}
      breadcrumb={
        <PageBreadcrumb
          items={[
            { label: c("Workspaces", "工作区"), href: "/dashboard/workspaces" },
            { label: title || c("Workspace", "工作区") },
          ]}
        />
      }
    >
      <main className="flex-1 overflow-y-auto">
        <div className="w-full md:px-3">
          {workspace.loading && !workspace.detail ? (
            <WorkspaceSkeleton label={c("Loading workspace", "正在加载工作区")} />
          ) : workspace.detail ? (
            <WorkspacePanel workspace={workspace} onDeleted={() => router.replace("/dashboard/workspaces")} className="md:pt-2" />
          ) : (
            <div role="status" className="space-y-3 px-[16px] py-10 md:px-5">
              <p className="text-sm text-foreground">
                {workspace.unavailable
                  ? c("Workspaces are unavailable right now.", "工作区暂时不可用。")
                  : c("This workspace does not exist.", "这个工作区不存在。")}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/workspaces">{c("All workspaces", "全部工作区")}</Link>
              </Button>
            </div>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}

/** Mirrors WorkspacePanel: header, research launcher, chats card, conclusion card. */
function WorkspaceSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="w-full min-w-0 space-y-8 px-4 pb-10 pt-5 md:px-5 md:pt-2">
      <span className="sr-only">{label}</span>
      <div className="space-y-3">
        <Skeleton className="h-7 w-48 rounded-lg" />
        <div className="flex gap-2">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-7 w-16 rounded-full" />)}
        </div>
        <Skeleton className="h-4 w-3/4 rounded-md" />
      </div>
      <div className="space-y-2.5">
        <div className="flex justify-between"><Skeleton className="h-4 w-20 rounded-md" /><Skeleton className="h-4 w-16 rounded-md" /></div>
        <div className="flex flex-wrap gap-1.5">
          {[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-8 w-20 rounded-full" />)}
        </div>
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Card className="space-y-4 p-4">
        <div className="flex justify-between"><Skeleton className="h-4 w-12 rounded-md" /><Skeleton className="h-4 w-16 rounded-md" /></div>
        {[0, 1].map(i => <div key={i} className="flex items-center gap-3"><Skeleton className="h-4 w-4 rounded-md" /><Skeleton className="h-4 w-2/3 rounded-md" /></div>)}
      </Card>
      <Card className="space-y-3 p-4">
        <div className="flex justify-between"><Skeleton className="h-4 w-24 rounded-md" /><Skeleton className="h-3.5 w-20 rounded-md" /></div>
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-4 rounded-md" />
          <Skeleton className="h-4 rounded-md" />
          <Skeleton className="h-4 w-5/6 rounded-md" />
        </div>
      </Card>
    </div>
  );
}
