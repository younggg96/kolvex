"use client";

import { useEffect, useState } from "react";
import { Check, FolderKanban, FolderPlus, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCopy } from "@/components/decision/shared";
import { cn } from "@/lib/utils";
import { parseTickers } from "@/lib/researchWorkspaceApi";
import type { ChatWorkspace } from "./useChatWorkspace";
import { workspaceErrorCode } from "./useChatWorkspace";
import { workspaceErrorText } from "./parts";

/**
 * The chat header's workspace control: shows which workspace this chat belongs to
 * and lets the reader join, switch, create or leave one without leaving the chat.
 */
export function WorkspacePicker({ workspace, suggestedTitle }: { workspace: ChatWorkspace; suggestedTitle?: string }) {
  const c = useCopy();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [tickers, setTickers] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = workspace.detail;
  const { loadWorkspaces } = workspace;

  useEffect(() => {
    if (open) void loadWorkspaces();
    if (!open) {
      setCreating(false);
      setError(null);
    }
  }, [open, loadWorkspaces]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setOpen(false);
    } catch (err) {
      setError(workspaceErrorCode(err));
    } finally {
      setBusy(null);
    }
  };

  const startCreating = () => {
    setTitle(suggestedTitle && suggestedTitle !== "New Chat" ? suggestedTitle.slice(0, 120) : "");
    setTickers(current?.tickers.join(" ") ?? "");
    setCreating(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="xs" className="max-w-[14rem] gap-2 max-md:h-11 max-md:max-w-[9.5rem]" disabled={workspace.loading || workspace.unavailable}>
          <FolderKanban className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{current ? current.title : c("Add to workspace", "加入工作区")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] p-2">
        {!creating ? (
          <div className="space-y-1">
            <p className="px-2 pb-1 pt-1 text-xs text-muted-foreground">{c("Workspaces", "工作区")}</p>
            {workspace.workspaces === null ? (
              <p className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {c("Loading", "加载中")}
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto">
                {workspace.workspaces.map((item) => {
                  const selected = item.id === current?.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={selected || busy !== null}
                        onClick={() => act(item.id, () => workspace.join(item.id))}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-foreground/[0.06] focus-visible:bg-foreground/[0.06] focus-visible:outline-none",
                          selected && "bg-foreground/[0.06]",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{item.title}</span>
                          <span className="block truncate text-xs text-muted-foreground figure">
                            {[item.tickers.slice(0, 4).join(" · "), c(`${item.chat_count} chats`, `${item.chat_count} 个对话`)]
                              .filter(Boolean).join("  ·  ")}
                          </span>
                        </span>
                        {busy === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        ) : selected ? (
                          <Check className="h-4 w-4 text-foreground" aria-label={c("Current", "当前")} />
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {workspace.listFailed ? (
              <div role="alert" className="flex items-center justify-between gap-2 px-2 py-2">
                <p className="text-sm text-negative">{c("Workspaces could not load.", "工作区加载失败。")}</p>
                <Button variant="ghost" size="xs" onClick={() => void workspace.loadWorkspaces()}>{c("Retry", "重试")}</Button>
              </div>
            ) : workspace.workspaces?.length === 0 && (
              <p className="px-2 py-2 text-sm text-muted-foreground">{c("No workspaces yet.", "还没有工作区。")}</p>
            )}
            <div className="flex items-center justify-between gap-2 border-t border-border px-1 pt-2">
              <Button variant="ghost" size="xs" className="gap-2" onClick={startCreating}>
                <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
                {c("New workspace", "新建工作区")}
              </Button>
              {current && (
                <Button variant="ghost" size="xs" disabled={busy !== null} onClick={() => act("leave", workspace.leave)}>
                  {c("Remove this chat", "移出此对话")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <form
            className="space-y-3 p-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!title.trim()) return;
              void act("create", () => workspace.createAndJoin(title.trim(), parseTickers(tickers)));
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="workspace-title" className="text-xs text-muted-foreground">{c("Name", "名称")}</label>
              <Input id="workspace-title" value={title} maxLength={120} autoFocus onChange={(e) => setTitle(e.target.value)}
                placeholder={c("e.g. AI semiconductors", "例如：AI 半导体")} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="workspace-tickers" className="text-xs text-muted-foreground">{c("Tickers", "股票")}</label>
              <Input id="workspace-tickers" value={tickers} onChange={(e) => setTickers(e.target.value)}
                placeholder="NVDA AMD TSM" autoCapitalize="characters" spellCheck={false} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="xs" onClick={() => setCreating(false)}>{c("Back", "返回")}</Button>
              <Button type="submit" size="xs" disabled={!title.trim() || busy !== null}>
                {busy === "create" && <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                {c("Create and add chat", "创建并加入")}
              </Button>
            </div>
          </form>
        )}
        {error && <p role="alert" className="px-2 pb-1 pt-2 text-xs text-negative">{workspaceErrorText(error, c)}</p>}
      </PopoverContent>
    </Popover>
  );
}
