"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { AdminRowsSkeleton } from "@/components/admin/AdminSkeletons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { SettingsGroup, SettingsRow } from "@/components/ui/settings-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";
import { parseHandles } from "@/lib/xCrawlerHandles";

interface Source {
  username: string;
  enabled: boolean;
  /** Set when the creator was deleted: hidden here, never crawled. */
  deleted_at?: string | null;
}
interface Limits {
  max_posts_per_creator: number;
  max_scrolls_per_creator: number;
}
interface CrawlerSettings {
  sources: Source[];
  settings: Limits;
}

const LIMITS = {
  max_posts_per_creator: [1, 2000],
  max_scrolls_per_creator: [1, 300],
} as const;

const MAX_BATCH = 200;

async function request<T>(
  method: "GET" | "PUT" | "POST" | "DELETE",
  body?: unknown,
  query = "",
): Promise<T> {
  const response = await fetch(`/api/admin/x-crawler${query}`, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "unavailable");
  return data as T;
}

export default function XCrawlerSettingsPanel() {
  const { locale } = useTranslation();
  const c = useCallback((en: string, zh: string) => (locale === "zh" ? zh : en), [locale]);
  const [data, setData] = useState<CrawlerSettings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [handle, setHandle] = useState("");
  const [limits, setLimits] = useState({ max_posts_per_creator: "", max_scrolls_per_creator: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  const describe = useCallback(
    (code: string) =>
      ({
        tables_missing: c(
          "A crawler settings migration is missing. Apply the x_crawl migrations in kolvex-backend-py/supabase/migrations first.",
          "数据库缺少采集设置迁移，请先执行 kolvex-backend-py/supabase/migrations 里 x_crawl 相关的迁移。",
        ),
        forbidden: c("Administrator access required.", "需要管理员权限。"),
        unauthorized: c("Sign in first.", "请先登录。"),
        invalid: c("Check the values and try again.", "请检查输入后重试。"),
        not_deployed: c(
          "The backend does not have this endpoint yet. Restart the backend.",
          "后端还没有这个接口，请重启后端。",
        ),
      })[code] ?? c("Crawler settings are unavailable. Retry.", "采集设置暂不可用，请重试。"),
    [c],
  );

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const result = await request<CrawlerSettings>("GET");
      setData(result);
      setLimits({
        max_posts_per_creator: String(result.settings.max_posts_per_creator),
        max_scrolls_per_creator: String(result.settings.max_scrolls_per_creator),
      });
    } catch (err) {
      setLoadError(describe(err instanceof Error ? err.message : ""));
    }
  }, [describe]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveSource(username: string, enabled: boolean, key: string) {
    setBusy(key);
    setError("");
    setMessage("");
    try {
      const { source } = await request<{ source: Source }>("POST", { username, enabled });
      setData((current) => {
        if (!current) return current;
        const rest = current.sources.filter((item) => item.username !== source.username);
        return {
          ...current,
          sources: [...rest, source].sort((a, b) => a.username.localeCompare(b.username)),
        };
      });
      return true;
    } catch (err) {
      setError(describe(err instanceof Error ? err.message : ""));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function addSources(event: React.FormEvent) {
    event.preventDefault();
    const { usernames, invalid } = parseHandles(handle);
    if (invalid.length) {
      const shown = invalid.slice(0, 5).join(", ") + (invalid.length > 5 ? " …" : "");
      setError(
        c(
          `Not a valid X username or https://x.com link: ${shown}. Nothing was added.`,
          `以下内容不是有效的 X 用户名或 https://x.com 链接：${shown}。未添加任何账号。`,
        ),
      );
      setMessage("");
      return;
    }
    if (usernames.length > MAX_BATCH) {
      setError(
        c(`Add at most ${MAX_BATCH} accounts at a time.`, `一次最多添加 ${MAX_BATCH} 个账号。`),
      );
      setMessage("");
      return;
    }
    const before = new Map(
      (data?.sources ?? [])
        .filter((item) => !item.deleted_at)
        .map((item) => [item.username, item.enabled]),
    );
    setBusy("add");
    setError("");
    setMessage("");
    try {
      const { sources: saved } = await request<{ sources: Source[] }>(
        "POST",
        { usernames },
        "?batch=1",
      );
      setData((current) => {
        if (!current) return current;
        const merged = new Map(current.sources.map((item) => [item.username, item]));
        for (const item of saved) merged.set(item.username, item);
        return {
          ...current,
          sources: [...merged.values()].sort((a, b) => a.username.localeCompare(b.username)),
        };
      });
      const added = usernames.filter((name) => !before.has(name)).length;
      const reenabled = usernames.filter((name) => before.get(name) === false).length;
      const unchanged = usernames.length - added - reenabled;
      setHandle("");
      setMessage(
        c(
          `Added ${added}, turned back on ${reenabled}, already on ${unchanged}. They are scanned from the next run.`,
          `新增 ${added} 个，重新开启 ${reenabled} 个，${unchanged} 个已在名单中。下一轮采集生效。`,
        ),
      );
    } catch (err) {
      setError(describe(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(null);
    }
  }

  async function deleteCreator() {
    if (!removing || busy) return;
    const name = removing;
    setBusy("delete");
    setError("");
    setMessage("");
    try {
      const result = await request<{ username: string; posts: number; media: number }>(
        "DELETE",
        undefined,
        `?creator=${encodeURIComponent(name)}`,
      );
      setData((current) =>
        current
          ? {
              ...current,
              sources: current.sources.filter((item) => item.username !== name),
            }
          : current,
      );
      setMessage(
        c(
          `Deleted @${name}: ${result.posts} posts and ${result.media} media files. Crawling is off.`,
          `已删除 @${name}：${result.posts} 条推文、${result.media} 个媒体文件，并已停止抓取。`,
        ),
      );
    } catch (err) {
      setError(describe(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(null);
      setRemoving(null);
    }
  }

  async function saveLimits(event: React.FormEvent) {
    event.preventDefault();
    const values = {} as Limits;
    for (const [key, [low, high]] of Object.entries(LIMITS) as [
      keyof Limits,
      readonly [number, number],
    ][]) {
      const value = Number(limits[key]);
      if (!/^\d+$/.test(limits[key]) || value < low || value > high) {
        setError(
          c(`Enter a whole number from ${low} to ${high}.`, `请输入 ${low} 至 ${high} 的整数。`),
        );
        return;
      }
      values[key] = value;
    }
    setBusy("limits");
    setError("");
    setMessage("");
    try {
      await request("PUT", values);
      setData((current) => (current ? { ...current, settings: values } : current));
      setMessage(c("Limits saved. They apply from the next run.", "限制已保存，下一轮采集生效。"));
    } catch (err) {
      setError(describe(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(null);
    }
  }

  if (!data && !loadError)
    return <AdminRowsSkeleton label={c("Loading crawler settings", "正在加载采集设置")} rows={4} />;

  if (loadError)
    return (
      <section className="space-y-3">
        <p role="alert" className="break-words text-sm text-destructive">
          {loadError}
        </p>
        <Button variant="outline" onClick={() => void load()}>
          {c("Retry", "重试")}
        </Button>
      </section>
    );

  const sources = (data?.sources ?? []).filter((item) => !item.deleted_at);
  const enabledCount = sources.filter((item) => item.enabled).length;

  return (
    <section
      aria-label={c("X crawler settings", "X 采集设置")}
      className="space-y-6"
      aria-busy={busy !== null}
    >
      <div className="flex items-center gap-1.5">
        <h2 className="text-base font-semibold">{c("X crawler", "X 采集")}</h2>
        <InfoTip label={c("About the X crawler", "关于 X 采集")}>
          {c(
            "The local collector on the Mac reads this list before every run. Turning an account off stops future scans; posts already imported stay.",
            "本机采集程序每轮开始前读取这份名单。关闭后不再抓取该账号，已导入的推文保留。",
          )}
        </InfoTip>
      </div>

      <form noValidate onSubmit={addSources} className="space-y-2">
        <Textarea
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder={c(
            "@username or x.com link — one per line, or separated by commas",
            "@用户名 或 x.com 链接，每行一个，或用逗号分隔",
          )}
          aria-label={c("X accounts to add", "要添加的 X 账号")}
          rows={3}
          maxLength={8000}
          autoComplete="off"
          spellCheck={false}
          disabled={busy !== null}
          className="sm:max-w-md"
        />
        <Button type="submit" variant="outline" disabled={busy !== null || !handle.trim()}>
          {(() => {
            const count = parseHandles(handle).usernames.length;
            return count > 1
              ? c(`Add ${count} accounts`, `添加 ${count} 个账号`)
              : c("Add account", "添加账号");
          })()}
        </Button>
      </form>

      <SettingsGroup
        label={c(
          `Accounts · ${enabledCount} of ${sources.length} on`,
          `账号 · 已开启 ${enabledCount} / ${sources.length}`,
        )}
      >
        {sources.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {c("No accounts yet.", "还没有账号。")}
          </p>
        ) : (
          sources.map((source) => (
            <SettingsRow
              key={source.username}
              label={
                <a
                  href={`https://x.com/${source.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={
                    source.enabled ? "hover:underline" : "text-muted-foreground hover:underline"
                  }
                >
                  @{source.username}
                </a>
              }
            >
              <div className="flex items-center gap-3">
                <span className="min-w-[3em] text-right text-xs">
                  {source.enabled ? c("On", "开启") : c("Off", "已关闭")}
                </span>
                <Switch
                  checked={source.enabled}
                  disabled={busy !== null}
                  aria-label={c(`Scan @${source.username}`, `抓取 @${source.username}`)}
                  onCheckedChange={(checked) =>
                    void saveSource(source.username, checked, source.username)
                  }
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="-mr-2 size-8 text-muted-foreground hover:text-negative"
                  disabled={busy !== null}
                  aria-label={c(`Delete @${source.username}`, `删除 @${source.username}`)}
                  onClick={() => setRemoving(source.username)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </SettingsRow>
          ))
        )}
      </SettingsGroup>

      <form noValidate onSubmit={saveLimits} className="space-y-3">
        <SettingsGroup label={c("Per-account limits per run", "每轮每个账号的上限")}>
          <SettingsRow input label={c("Max posts (1–2000)", "最多帖子数（1–2000）")}>
            <Input
              inputMode="numeric"
              value={limits.max_posts_per_creator}
              onChange={(e) => setLimits((v) => ({ ...v, max_posts_per_creator: e.target.value }))}
              maxLength={4}
              disabled={busy !== null}
            />
          </SettingsRow>
          <SettingsRow input label={c("Max scrolls (1–300)", "最多滚动次数（1–300）")}>
            <Input
              inputMode="numeric"
              value={limits.max_scrolls_per_creator}
              onChange={(e) =>
                setLimits((v) => ({ ...v, max_scrolls_per_creator: e.target.value }))
              }
              maxLength={3}
              disabled={busy !== null}
            />
          </SettingsRow>
        </SettingsGroup>
        <Button type="submit" variant="outline" disabled={busy !== null}>
          {c("Save limits", "保存上限")}
        </Button>
      </form>

      {error && (
        <p role="alert" className="break-words text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && busy === null && setRemoving(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="break-all">
              {c(`Delete @${removing}?`, `删除 @${removing}？`)}
            </DialogTitle>
            <DialogDescription>
              {c(
                "All of this creator's posts, AI analysis and archived media are removed from the site, and crawling stops. This cannot be undone.",
                "将从网站删除该博主的全部推文、AI 分析和已存档的媒体，并停止抓取。删除后无法恢复。",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={busy !== null} onClick={() => setRemoving(null)}>
              {c("Cancel", "取消")}
            </Button>
            <Button
              variant="destructive"
              disabled={busy !== null}
              onClick={() => void deleteCreator()}
            >
              {busy === "delete" ? c("Deleting…", "正在删除…") : c("Delete", "删除")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
