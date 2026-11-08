"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, FolderKanban, FolderPlus, Loader2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListCard, ListEmptyState, ListRow, ListRows, listRowTargetClass } from "@/components/ui/list-card";
import { SkeletonRepeat } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AgentStatusText, StanceText, formatRunTime, workspaceErrorText } from "@/components/chat/workspace/parts";
import { workspaceErrorCode } from "@/components/chat/workspace/useChatWorkspace";
import {
  createWorkspace,
  listWorkspaces,
  parseTickers,
  type WorkspaceListItem,
} from "@/lib/researchWorkspaceApi";

export default function WorkspacesPage() {
  const c = useCopy();
  const { locale } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<WorkspaceListItem[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [tickers, setTickers] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Error codes, not text: copy is chosen at render time so it follows the locale.
  const load = useCallback(async () => {
    setFailed(null);
    try {
      setItems(await listWorkspaces());
    } catch (error) {
      setItems([]);
      setFailed(workspaceErrorCode(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      const workspace = await createWorkspace({ title: title.trim(), tickers: parseTickers(tickers) });
      router.push(`/dashboard/workspaces/${workspace.id}`);
    } catch (error) {
      setFormError(workspaceErrorCode(error));
      setSaving(false);
    }
  };

  return (
    <DashboardLayout title={c("Workspaces", "工作区")}>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-6 px-[16px] pb-10 pt-6 md:px-8 md:pt-8">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{c("Workspaces", "工作区")}</h1>
            {!creating && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setCreating(true)}>
                <FolderPlus className="h-4 w-4" aria-hidden="true" />
                {c("New workspace", "新建工作区")}
              </Button>
            )}
          </div>

          {creating && (
            <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <Input aria-label={c("Name", "名称")} autoFocus value={title} maxLength={120} className="sm:flex-[3]"
                placeholder={c("Name, e.g. AI semiconductors", "名称，例如：AI 半导体")} onChange={(e) => setTitle(e.target.value)} />
              <Input aria-label={c("Tickers", "股票")} value={tickers} className="sm:flex-[2]" spellCheck={false}
                autoCapitalize="characters" placeholder="NVDA AMD TSM" onChange={(e) => setTickers(e.target.value)} />
              <div className="flex shrink-0 gap-2">
                <Button type="button" variant="ghost" onClick={() => { setCreating(false); setFormError(null); }}>{c("Cancel", "取消")}</Button>
                <Button type="submit" disabled={!title.trim() || saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                  {c("Create", "创建")}
                </Button>
              </div>
            </form>
          )}
          {formError && <p role="alert" className="-mt-3 text-sm text-negative">{workspaceErrorText(formError, c)}</p>}

          <ListCard>
            {items === null ? (
              <ListRows aria-busy="true">
                <SkeletonRepeat count={3}>
                  {(index) => (
                    <li key={index} className="flex min-h-20 items-center gap-3 px-2">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-56" /></div>
                    </li>
                  )}
                </SkeletonRepeat>
              </ListRows>
            ) : failed ? (
              <ListEmptyState alert title={workspaceErrorText(failed, c)} action={<Button variant="outline" size="sm" onClick={() => void load()}>{c("Retry", "重试")}</Button>} />
            ) : items.length === 0 ? (
              <ListEmptyState
                title={c("Group chats by topic and let the research team work on them.", "按主题归集对话，让研究团队一起研究。")}
                action={<Button size="sm" className="gap-2" onClick={() => setCreating(true)}><FolderPlus className="h-4 w-4" aria-hidden="true" />{c("New workspace", "新建工作区")}</Button>}
              />
            ) : (
              <ListRows>
                {items.map((item) => (
                  <ListRow key={item.id}>
                    <Link href={`/dashboard/workspaces/${item.id}`} className={cn(listRowTargetClass, "flex gap-3")}>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground/[0.06]" aria-hidden="true">
                        <FolderKanban className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.9375rem] font-semibold text-foreground">{item.title}</span>
                        <span className="figure block truncate text-xs text-muted-foreground">
                          {[item.tickers.join(" · "), c(`${item.chat_count} chats`, `${item.chat_count} 个对话`)].filter(Boolean).join("  ·  ")}
                        </span>
                      </span>
                      <span className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
                        {item.latest_run?.status === "running"
                          ? <AgentStatusText status="running" c={c} />
                          : <StanceText stance={item.latest_run?.stance} c={c} />}
                        <span className="figure text-xs text-muted-foreground">
                          {item.latest_run ? formatRunTime(item.latest_run.completed_at ?? item.latest_run.started_at, locale) : c("Not researched", "未研究")}
                        </span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  </ListRow>
                ))}
              </ListRows>
            )}
          </ListCard>
        </div>
      </main>
    </DashboardLayout>
  );
}
