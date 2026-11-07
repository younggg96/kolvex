import { useEffect } from "react";
import { ArticleSkeleton } from "../../components/Skeletons";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../state/Auth";
import { useResource } from "../../lib/useResource";
import { useMutation } from "../../lib/useMutation";
import { apiRequest } from "../../lib/http";
import type { TradingAnalysis } from "../../lib/contentTypes";
import { Page, Copy, Button } from "../../components/UI";
import { AuthGate, ResourceState } from "../../components/Content";
import { ReportBody } from "../../components/ReportBody";
import { ConfirmAction } from "../../components/ConfirmAction";
import { MutationStatus } from "../../components/MutationStatus";
export default function Task() {
  return (
    <AuthGate skeleton={<ArticleSkeleton />} title="研究任务">
      <Reader />
    </AuthGate>
  );
}
function Reader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth().session!.user.id;
  const r = useResource(`task:${user}:${id}`, (signal) =>
    apiRequest<TradingAnalysis>(`/trading-analysis/${encodeURIComponent(id)}`, {
      signal,
      authenticated: true,
      expectedUser: user,
    }),
  );
  const m = useMutation();
  const running = r.data && ["pending", "running"].includes(r.data.status);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(r.refresh, 5000);
    return () => clearInterval(timer);
  }, [running, r.refresh]);
  return (
    <Page
      title={r.data?.ticker || "研究任务"}
      subtitle={`${r.data?.trade_date || ""} · ${r.data?.status || "加载中"}`}
      onRefresh={r.refresh}
      refreshing={r.loading}
    >
      <ResourceState skeleton={<ArticleSkeleton />} resource={r} empty={!r.data} message="任务不可用" />
      {running && (
        <Copy>
          研究正在服务器运行，每 5 秒更新；离开此页不会取消服务器任务。
        </Copy>
      )}
      {r.data && <ReportBody item={r.data} />}
      <ConfirmAction
        label="删除研究任务"
        description="删除此研究及报告，无法恢复。运行中的任务请先核对服务器状态。"
        disabled={m.busy || !!running || !r.data}
        onConfirm={() =>
          void m.run(async (signal) => {
            await apiRequest(`/trading-analysis/${encodeURIComponent(id)}`, {
              method: "DELETE",
              signal,
              authenticated: true,
              expectedUser: user,
            });
            router.replace("/research-tasks");
          })
        }
      />
      <MutationStatus {...m} />
      <Button onPress={r.refresh}>刷新任务</Button>
    </Page>
  );
}
