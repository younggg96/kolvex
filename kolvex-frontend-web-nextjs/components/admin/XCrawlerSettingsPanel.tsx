"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminRowsSkeleton } from "@/components/admin/AdminSkeletons";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { SettingsGroup, SettingsRow } from "@/components/ui/settings-group";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/lib/i18n";

interface Source {
  username: string;
  enabled: boolean;
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

async function request<T>(method: "GET" | "PUT" | "POST", body?: unknown): Promise<T> {
  const response = await fetch("/api/admin/x-crawler", {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "unavailable");
  return data as T;
}

/** Profile URL or @handle → lowercase username; null if invalid. */
function parseHandle(value: string): string | null {
  let text = value.trim();
  const url = text.match(/^https:\/\/(?:www\.)?x\.com\/([^/?#]+)\/?(?:[?#].*)?$/i);
  if (url) text = url[1];
  text = text.replace(/^@/, "");
  return /^[A-Za-z0-9_]{1,15}$/.test(text) ? text.toLowerCase() : null;
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

  const describe = useCallback(
    (code: string) =>
      ({
        tables_missing: c(
          "Crawler settings tables are missing. Apply migration 20261126120000_x_crawler_settings.sql first.",
          "数据库还没有采集设置表，请先执行迁移 20261126120000_x_crawler_settings.sql。",
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

  async function addSource(event: React.FormEvent) {
    event.preventDefault();
    const username = parseHandle(handle);
    if (!username) {
      setError(
        c(
          "Enter an X username or an https://x.com/<username> link.",
          "请输入 X 用户名或 https://x.com/<用户名> 链接。",
        ),
      );
      return;
    }
    if (await saveSource(username, true, "add")) {
      setHandle("");
      setMessage(
        c(`@${username} will be scanned in the next run.`, `下一轮采集会抓取 @${username}。`),
      );
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

  const sources = data?.sources ?? [];
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

      <form noValidate onSubmit={addSource} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          placeholder={c("@username or x.com link", "@用户名 或 x.com 链接")}
          aria-label={c("X account to add", "要添加的 X 账号")}
          maxLength={60}
          autoComplete="off"
          disabled={busy !== null}
          className="sm:max-w-xs"
        />
        <Button type="submit" variant="outline" disabled={busy !== null || !handle.trim()}>
          {c("Add account", "添加账号")}
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
              <span className="mr-3 text-xs">
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
    </section>
  );
}
