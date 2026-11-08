"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageBreadcrumb from "@/components/layout/PageBreadcrumb";
import { Button } from "@/components/ui/button";
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
        <div className="mx-auto max-w-3xl md:px-3">
          {workspace.loading && !workspace.detail ? (
            <p role="status" className="flex items-center gap-2 px-[16px] py-10 text-sm text-muted-foreground md:px-5">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              {c("Loading workspace", "正在加载工作区")}
            </p>
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
