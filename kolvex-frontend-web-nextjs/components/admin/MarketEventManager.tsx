"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type MarketCalendar,
  type MarketEventEnvelope,
  EVENT_CATEGORIES,
} from "@/lib/marketEvents";

async function request<T>(
  query = "",
  body?: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/admin/market-events${query}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal,
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "事件请求失败，请重试。");
  return data;
}
export default function MarketEventManager() {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<MarketEventEnvelope | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<MarketCalendar | null>(null);
  const [listError, setListError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [dirty, setDirty] = useState(false);
  const editor = useRef<HTMLTextAreaElement>(null);
  const busyRef = useRef(false);
  const update = useCallback((value: string) => {
    setText(value);
    setPreview(null);
    setError("");
    setMessage("");
    setDirty(!!value);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setListError("");
    request<MarketCalendar>(`?page=${page}`, undefined, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setList(data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setListError("无法读取事件列表，请刷新重试。");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [page, attempt]);
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试。");
      editor.current?.focus();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">重大事件管理</h2>
        <p id="event-help" className="text-sm leading-6 text-muted-foreground">
          粘贴或上传 kolvex-market-events/1.0 JSON，校验预览后保存。同一 ID
          会覆盖原事件，其他事件保留。published 且 importance 为 high 或 is_hot
          为 true 的事件，才会在行情日历中显示；draft 和 cancelled
          可用于下架。日历仅展示美东时间上周、本周和下周。
        </p>
        <a
          href="/examples/market-events.json"
          download
          className="inline-block rounded text-sm font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          下载 JSON 模板（草稿示例）
        </a>
      </div>
      <div className="space-y-2">
        <label htmlFor="event-file" className="text-sm font-medium">
          上传 JSON（最大 1 MB）
        </label>
        <Input
          id="event-file"
          type="file"
          accept=".json,application/json"
          disabled={busy || dirty}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            void run(async () => {
              if (file.size > 1024 * 1024) throw new Error("JSON 超过 1 MB。");
              update((await file.text()).replace(/^\uFEFF/, ""));
            });
          }}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="event-json" className="text-sm font-medium">
          事件 JSON
        </label>
        <Textarea
          ref={editor}
          id="event-json"
          className="h-80 resize-none font-mono text-xs"
          spellCheck={false}
          disabled={busy}
          value={text}
          onChange={(e) => update(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "event-help event-error" : "event-help"}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3" aria-busy={busy}>
        <Button
          variant="outline"
          disabled={busy || !text.trim()}
          onClick={() =>
            void run(async () => {
              if (new TextEncoder().encode(text).length > 1024 * 1024)
                throw new Error("JSON 超过 1 MB。");
              const result = await request<{ payload: MarketEventEnvelope }>(
                "?validate=1",
                text,
              );
              setPreview(result.payload);
            })
          }
        >
          校验并预览
        </Button>
        <Button
          disabled={busy || !preview}
          onClick={() =>
            void run(async () => {
              if (!preview) return;
              const result = await request<{ saved: number }>(
                "",
                JSON.stringify(preview),
              );
              setMessage(`已保存 ${result.saved} 个事件。`);
              setDirty(false);
              setPreview(null);
              setAttempt((n) => n + 1);
            })
          }
        >
          保存事件
        </Button>
        <Button
          variant="ghost"
          disabled={busy || !text}
          onClick={() => update("")}
        >
          清空编辑器
        </Button>
        {busy && (
          <span role="status" className="text-sm text-muted-foreground">
            处理中…
          </span>
        )}
      </div>
      {dirty && (
        <p className="text-xs text-muted-foreground">
          编辑器中有未保存内容。保存或清空后可加载另一事件或文件；切换后台栏目之前请先保存。
        </p>
      )}
      {error && (
        <p
          id="event-error"
          role="alert"
          className="rounded-xl border border-border p-4 text-sm text-negative"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-positive/10 p-4 text-sm">
          {message}
        </p>
      )}
      {preview && (
        <section className="space-y-4 rounded-xl border border-border p-4">
          <h3 className="font-semibold">
            保存预览 · {preview.events.length} 个事件
          </h3>
          <p className="text-sm text-muted-foreground">
            保存将更新这些 ID 的全部字段。若要下架，将 status 改为 draft 或
            cancelled 后重新保存。
          </p>
          <ul className="divide-y divide-border">
            {preview.events.map((event) => (
              <li key={event.id} className="break-words py-3 text-sm">
                <strong>{event.title}</strong>
                <p className="mt-1 text-xs text-muted-foreground">
                  {event.id} · {event.event_date} ·{" "}
                  {EVENT_CATEGORIES[event.category][1]} · {event.status} ·{" "}
                  {event.importance}
                  {event.is_hot && " · 热门"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="space-y-4" aria-busy={loading}>
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold">已保存事件（含历史与草稿）</h3>
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => setAttempt((n) => n + 1)}
          >
            刷新列表
          </Button>
        </div>
        {listError ? (
          <p role="alert" className="text-sm text-negative">
            {listError}
          </p>
        ) : loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            加载中…
          </p>
        ) : !list?.events.length ? (
          <p className="text-sm text-muted-foreground">
            暂无事件，请导入第一份 JSON。
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {list.events.map((event) => (
              <li
                key={event.id}
                className="flex items-start justify-between gap-4 py-4"
              >
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    {event.event_date} · {event.status} · {event.importance}
                    {event.is_hot && " · 热门"}
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold">
                    {event.title}
                  </p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {event.id}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || dirty}
                  onClick={() => {
                    update(
                      JSON.stringify(
                        {
                          schema_version: "kolvex-market-events/1.0",
                          timezone: "America/New_York",
                          events: [event],
                        },
                        null,
                        2,
                      ),
                    );
                    editor.current?.focus();
                  }}
                >
                  编辑 JSON
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            第 {page} 页 · 共 {list?.total ?? 0} 个事件
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={loading || page === 1}
              onClick={() => setPage((n) => n - 1)}
            >
              上一页
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={loading || page * 200 >= (list?.total ?? 0)}
              onClick={() => setPage((n) => n + 1)}
            >
              下一页
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
