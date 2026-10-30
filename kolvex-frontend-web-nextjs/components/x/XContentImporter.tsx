"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { useTranslation } from "@/lib/i18n";
import { xRequest, type XPreview } from "@/lib/xContentApi";

export default function XContentImporter({ onSaved }: { onSaved: () => void }) {
  const { profile } = useUserProfileContext();
  const { locale } = useTranslation();
  const c = (en: string, zh: string) => (locale === "zh" ? zh : en);
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [payload, setPayload] = useState<unknown>(null);
  const [preview, setPreview] = useState<XPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [handleInvalid, setHandleInvalid] = useState(false);
  const [message, setMessage] = useState("");
  const handleRef = useRef<HTMLInputElement>(null);
  if (!profile?.is_admin) return null;

  async function saveCreator(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setMessage("");
    setHandleInvalid(false);
    if (!/^@?[A-Za-z0-9_]{1,15}$/.test(handle.trim())) {
      setHandleInvalid(true);
      setError(
        c(
          "Use a username with 1–15 letters, numbers or underscores.",
          "请输入 1 至 15 位字母、数字或下划线组成的 X 用户名。",
        ),
      );
      handleRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      await xRequest("creators", {
        method: "POST",
        body: JSON.stringify({
          username: handle.trim(),
          display_name: name,
          bio,
        }),
      });
      setMessage(c("Creator saved.", "博主已保存。"));
      setHandle("");
      setName("");
      setBio("");
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : c("Save failed. Retry.", "保存失败，请重试。"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function chooseFile(file?: File) {
    setPayload(null);
    setPreview(null);
    setError("");
    setMessage("");
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError(
        c(
          "Choose a JSON file smaller than 2 MB.",
          "请选择小于 2 MB 的 JSON 文件。",
        ),
      );
      return;
    }
    setBusy(true);
    try {
      const value: unknown = JSON.parse(await file.text());
      const result = await xRequest<XPreview>("validate", {
        method: "POST",
        body: JSON.stringify(value),
      });
      setPayload(value);
      setPreview(result);
    } catch (err) {
      setError(
        err instanceof SyntaxError
          ? c(
              "Invalid JSON. Check the file and try again.",
              "JSON 格式无效，请检查文件后重试。",
            )
          : err instanceof Error
            ? err.message
            : c("Validation failed.", "校验失败。"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    if (busy || !payload || !preview) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await xRequest<{ inserted: number; skipped: number }>(
        "upload",
        { method: "POST", body: JSON.stringify(payload) },
      );
      setMessage(
        c(
          `${result.inserted} posts imported; ${result.skipped} existing posts skipped.`,
          `已导入 ${result.inserted} 条推文，跳过 ${result.skipped} 条已有推文。`,
        ),
      );
      setPayload(null);
      setPreview(null);
      onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : c("Import failed. Retry.", "导入失败，请重试。"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-xl border border-border bg-card p-4">
      <summary className="w-fit cursor-pointer rounded-sm text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {c("Manage creators and import posts", "管理博主与导入推文")}
      </summary>
      <div className="mt-4 space-y-6" aria-busy={busy}>
        <form noValidate onSubmit={saveCreator} className="space-y-3">
          <h2 className="text-base font-semibold">
            {c("Save creator profile", "保存博主资料")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {c(
              "An existing username updates that creator’s profile. Posts are imported separately.",
              "相同用户名会更新该博主资料。推文需另行导入。",
            )}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="x-handle" className="mb-1 block text-sm">
                {c("X username", "X 用户名")}
              </label>
              <Input
                ref={handleRef}
                id="x-handle"
                value={handle}
                onChange={(e) => {
                  setHandle(e.target.value);
                  setHandleInvalid(false);
                }}
                aria-invalid={handleInvalid}
                aria-describedby={handleInvalid ? "x-admin-error" : undefined}
                maxLength={16}
                disabled={busy}
                autoComplete="off"
                placeholder="@username"
              />
            </div>
            <div>
              <label htmlFor="x-name" className="mb-1 block text-sm">
                {c("Display name", "显示名称")}
              </label>
              <Input
                id="x-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                disabled={busy}
              />
            </div>
          </div>
          <div>
            <label htmlFor="x-bio" className="mb-1 block text-sm">
              {c("Bio", "简介")}
            </label>
            <Input
              id="x-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={1000}
              disabled={busy}
            />
          </div>
          <Button type="submit" variant="outline" disabled={busy}>
            {c("Save creator", "保存博主")}
          </Button>
        </form>
        <div className="space-y-3">
          <h2 className="text-base font-semibold">
            {c("Import posts", "导入推文")}
          </h2>
          <p
            id="x-file-help"
            className="text-sm leading-6 text-muted-foreground"
          >
            {c(
              "Choose a JSON export with up to 500 posts, at most 2 MB. Review the preview before importing. Existing post IDs are skipped, preserving saved content.",
              "选择最多 500 条推文、大小不超过 2 MB 的 JSON 文件，预览后导入。已有推文 ID 会被跳过，保留已存内容。",
            )}
          </p>
          <label htmlFor="x-file" className="block text-sm">
            {c("Post JSON file", "推文 JSON 文件")}
          </label>
          <input
            id="x-file"
            type="file"
            accept="application/json,.json"
            aria-describedby="x-file-help"
            disabled={busy}
            className="block w-full min-w-0 rounded-sm text-sm file:mr-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-2 file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onChange={(e) => {
              void chooseFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <details className="text-xs text-muted-foreground">
            <summary className="w-fit cursor-pointer rounded-sm py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
              {c("JSON format", "JSON 格式")}
            </summary>
            <p className="mb-2 leading-5">
              {c(
                "Accepts an array or an object with a posts array. Optional: cashtags, metrics, quoted_texts, media_links, truncated, pinned. Times require a timezone; IDs must be strings.",
                "支持数组或包含 posts 数组的对象。可选字段：cashtags、metrics、quoted_texts、media_links、truncated、pinned。时间必须含时区，ID 必须是字符串。",
              )}
            </p>
            <pre
              className="overflow-x-auto rounded-lg bg-muted p-3"
              tabIndex={0}
            >
              {JSON.stringify(
                [
                  {
                    id: "2114829879803785351",
                    author_username: "MentoviaX",
                    published_at: "2026-10-26T21:21:49Z",
                    text: "$SPCX",
                    url: "https://x.com/MentoviaX/status/2114829879803785351",
                  },
                ],
                null,
                2,
              )}
            </pre>
          </details>
          {preview && (
            <div
              className="space-y-2 rounded-lg bg-muted p-3 text-sm"
              role="status"
            >
              <p>
                {c(
                  `${preview.total} posts · ${preview.authors.length} creators`,
                  `${preview.total} 条推文 · ${preview.authors.length} 位博主`,
                )}
              </p>
              <p className="break-words">
                {preview.authors.map((author) => `@${author}`).join(", ")}
              </p>
              <p className="break-words">
                {preview.tickers.map((ticker) => `$${ticker}`).join(" · ") ||
                  c("No stock tags", "无股票标签")}
              </p>
              {preview.truncated > 0 && (
                <p>
                  {c(
                    `${preview.truncated} posts are marked incomplete.`,
                    `${preview.truncated} 条推文标记为正文不完整。`,
                  )}
                </p>
              )}
              <Button onClick={() => void upload()} disabled={busy}>
                {c("Import posts", "导入推文")}
              </Button>
            </div>
          )}
        </div>
        {busy && (
          <p role="status" className="text-sm text-muted-foreground">
            {c("Processing…", "正在处理…")}
          </p>
        )}
        {error && (
          <p
            id="x-admin-error"
            role="alert"
            className="break-words text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </div>
    </details>
  );
}
