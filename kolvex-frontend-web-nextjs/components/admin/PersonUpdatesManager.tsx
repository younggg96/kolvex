"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { AdminRowsSkeleton } from "@/components/admin/AdminSkeletons";
import PersonAvatarsEditor from "@/components/admin/PersonAvatarsEditor";
import PersonUpdatesImporter from "@/components/admin/PersonUpdatesImporter";
import { useCopy } from "@/components/decision/shared";
import { PersonUpdateAvatar } from "@/components/person-updates/PersonUpdateAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isFedOfficial, personAvatar, type PersonUpdate } from "@/lib/personUpdates";

type Draft = {
  id: string;
  person: string;
  person_cn: string;
  published_at: string;
  title: string;
  summary: string;
  source_url: string;
  impact: PersonUpdate["impact"];
  tags: string;
  tickers: string;
  avatar_url: string;
  image_url: string;
  image_alt: string;
};

const EMPTY: Draft = {
  id: "",
  person: "",
  person_cn: "",
  published_at: "",
  title: "",
  summary: "",
  source_url: "",
  impact: "medium",
  tags: "",
  tickers: "",
  avatar_url: "",
  image_url: "",
  image_alt: "",
};

/** ISO timestamp → value for <input type="datetime-local"> in the browser's zone. */
function toLocalInput(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toDraft(item: PersonUpdate): Draft {
  return {
    ...item,
    published_at: toLocalInput(item.published_at),
    tags: item.tags.join(", "),
    tickers: item.tickers.join(", "),
    avatar_url: item.avatar_url ?? "",
    image_url: item.image_url ?? "",
    image_alt: item.image_alt ?? "",
  };
}

function newId(person: string, publishedAt: string) {
  const slug = person
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const day = (publishedAt || new Date().toISOString()).slice(0, 10).replace(/-/g, "");
  return `${slug || "update"}-${day}-${Math.random().toString(36).slice(2, 8)}`;
}

const list = (value: string) =>
  value
    .split(/[,，]/)
    .map((part) => part.trim())
    .filter(Boolean);
const optional = (value: string) => value.trim() || null;

async function errorText(response: Response) {
  const raw = await response.text();
  try {
    const detail = JSON.parse(raw).detail;
    if (typeof detail === "string") return detail;
  } catch {}
  return raw || `HTTP ${response.status}`;
}

export default function PersonUpdatesManager() {
  const c = useCopy();
  const [items, setItems] = useState<PersonUpdate[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState(false);
  const [addMode, setAddMode] = useState<"manual" | "json">("manual");
  const [formError, setFormError] = useState("");
  const [removing, setRemoving] = useState<PersonUpdate | null>(null);
  const [busy, setBusy] = useState(false);
  const [portraitsOpen, setPortraitsOpen] = useState(false);
  const loadErrorMessage = c("Could not load updates.", "无法加载动态。");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const response = await fetch("/api/person-updates", { cache: "no-store" });
      if (!response.ok) throw new Error(await errorText(response));
      const data: { items: PersonUpdate[] } = await response.json();
      setItems(data.items);
    } catch (error) {
      setItems(null);
      setLoadError(loadErrorMessage + (error instanceof Error ? ` ${error.message}` : ""));
    }
  }, [loadErrorMessage]);

  useEffect(() => {
    void load();
  }, [load]);

  const field = (key: keyof Draft) => ({
    id: `person-update-${key}`,
    value: draft?.[key] ?? "",
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((current) => current && { ...current, [key]: event.target.value }),
  });

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft || busy) return;
    const publishedAt = new Date(draft.published_at);
    if (Number.isNaN(publishedAt.getTime())) {
      setFormError(c("Enter the publish time.", "请填写发布时间。"));
      return;
    }
    const item = {
      id: draft.id || newId(draft.person, draft.published_at),
      person: draft.person.trim(),
      person_cn: draft.person_cn.trim(),
      published_at: publishedAt.toISOString(),
      title: draft.title.trim(),
      summary: draft.summary.trim(),
      source_url: draft.source_url.trim(),
      impact: draft.impact,
      tags: list(draft.tags),
      tickers: list(draft.tickers),
      avatar_url: optional(draft.avatar_url),
      image_url: optional(draft.image_url),
      image_alt: optional(draft.image_alt),
    };
    setBusy(true);
    setFormError("");
    try {
      const response = await fetch("/api/admin/person-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": c("en", "zh") },
        body: JSON.stringify({ items: [item] }),
      });
      if (!response.ok) {
        setFormError(await errorText(response));
        return;
      }
      setDraft(null);
      setMessage(
        editing
          ? c(`Updated ${item.id}.`, `已更新 ${item.id}。`)
          : c(`Added ${item.id}.`, `已新增 ${item.id}。`),
      );
      await load();
    } catch (error) {
      setFormError(
        c("Save failed.", "保存失败。") + (error instanceof Error ? ` ${error.message}` : ""),
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removing || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/person-updates/${encodeURIComponent(removing.id)}`, {
        method: "DELETE",
        headers: { "Accept-Language": c("en", "zh") },
      });
      setMessage(
        response.ok
          ? c(`Deleted ${removing.id}.`, `已删除 ${removing.id}。`)
          : await errorText(response),
      );
      setRemoving(null);
      await load();
    } catch (error) {
      setMessage(
        c("Delete failed.", "删除失败。") + (error instanceof Error ? ` ${error.message}` : ""),
      );
      setRemoving(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">{c("Saved updates", "已保存动态")}</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy || !items}
            onClick={() => setPortraitsOpen(true)}
          >
            <UserRound className="size-4" aria-hidden />
            {c("Portraits", "人物头像")}
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              setEditing(false);
              setAddMode("manual");
              setFormError("");
              setDraft({ ...EMPTY, published_at: toLocalInput(new Date().toISOString()) });
            }}
          >
            <Plus className="size-4" aria-hidden />
            {c("Add update", "新增动态")}
          </Button>
        </div>
      </div>
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      {loadError ? (
        <div className="space-y-2">
          <p role="alert" className="text-sm text-negative">
            {loadError}
          </p>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            {c("Retry", "重试")}
          </Button>
        </div>
      ) : !items ? (
        <AdminRowsSkeleton label={c("Loading updates", "正在加载动态")} />
      ) : !items.length ? (
        <p className="text-sm text-muted-foreground">{c("No updates yet.", "暂无动态。")}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card [&>li]:px-4">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3">
              <PersonUpdateAvatar
                label={item.person_cn}
                src={personAvatar(item)}
                fedOfficial={isFedOfficial(item)}
                className="size-9 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {c(item.person, item.person_cn)} ·{" "}
                  {new Date(item.published_at).toLocaleString(c("en-US", "zh-CN"))} · {item.impact}
                </p>
                <p className="mt-1 break-words text-sm font-semibold">{item.title}</p>
                <p className="mt-1 break-all text-xs text-muted-foreground">{item.id}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={c(`Edit ${item.id}`, `编辑 ${item.id}`)}
                  disabled={busy}
                  onClick={() => {
                    setEditing(true);
                    setFormError("");
                    setDraft(toDraft(item));
                  }}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={c(`Delete ${item.id}`, `删除 ${item.id}`)}
                  disabled={busy}
                  onClick={() => setRemoving(item)}
                >
                  <Trash2 className="size-4 text-negative" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={portraitsOpen} onOpenChange={setPortraitsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{c("Portraits", "人物头像")}</DialogTitle>
            <DialogDescription>
              {c(
                "One portrait per person. New updates never replace it.",
                "每人一个头像，新动态不会覆盖。",
              )}
            </DialogDescription>
          </DialogHeader>
          {items && <PersonAvatarsEditor items={items} onSaved={load} />}
        </DialogContent>
      </Dialog>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && !busy && setDraft(null)}>
        <DialogContent
          className="sm:max-w-2xl"
          showCloseButton={!busy}
          onEscapeKeyDown={(event) => busy && event.preventDefault()}
          onPointerDownOutside={(event) => busy && event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>
              {editing ? c("Edit update", "编辑动态") : c("Add update", "新增动态")}
            </DialogTitle>
            {editing ? (
              <DialogDescription className="break-all">{draft?.id}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">
                {c("Enter an update or import JSON.", "手动填写动态，或导入 JSON。")}
              </DialogDescription>
            )}
          </DialogHeader>
          {!editing && (
            <div className="mb-4">
              <SegmentedControl
                semantics="radio"
                label={c("Add method", "新增方式")}
                value={addMode}
                onChange={setAddMode}
                options={[
                  { value: "manual", label: c("Manual entry", "手动填写"), disabled: busy },
                  { value: "json", label: c("Upload JSON", "上传 JSON"), disabled: busy },
                ]}
              />
            </div>
          )}
          {!editing && (
            <div hidden={addMode !== "json"}>
              <PersonUpdatesImporter busy={busy} onBusyChange={setBusy} onSaved={load} />
            </div>
          )}
          <form
            className={editing || addMode === "manual" ? "grid gap-4 sm:grid-cols-2" : "hidden"}
            onSubmit={save}
          >
            <div className="space-y-1.5">
              <Label htmlFor="person-update-person">{c("Name (English)", "英文名")}</Label>
              <Input required {...field("person")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-update-person_cn">{c("Name (Chinese)", "中文名")}</Label>
              <Input required {...field("person_cn")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-update-published_at">{c("Published", "发布时间")}</Label>
              <Input type="datetime-local" required {...field("published_at")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-update-impact">{c("Impact", "影响")}</Label>
              <Select
                value={draft?.impact ?? EMPTY.impact}
                onValueChange={(impact) =>
                  setDraft(
                    (current) =>
                      current && { ...current, impact: impact as PersonUpdate["impact"] },
                  )
                }
              >
                <SelectTrigger id="person-update-impact">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">{c("High", "高")}</SelectItem>
                  <SelectItem value="medium">{c("Medium", "中")}</SelectItem>
                  <SelectItem value="low">{c("Low", "低")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="person-update-title">{c("Title", "标题")}</Label>
              <Input required {...field("title")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="person-update-summary">{c("Summary", "摘要")}</Label>
              <Textarea required rows={4} {...field("summary")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="person-update-source_url">{c("Source URL", "原文链接")}</Label>
              <Input type="url" required placeholder="https://" {...field("source_url")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-update-tags">
                {c("Topics, comma separated", "主题，逗号分隔")}
              </Label>
              <Input {...field("tags")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-update-tickers">
                {c("Tickers, comma separated", "股票代码，逗号分隔")}
              </Label>
              <Input {...field("tickers")} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="person-update-avatar_url">{c("Avatar URL", "头像链接")}</Label>
              <Input type="url" placeholder="https://" {...field("avatar_url")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-update-image_url">{c("Image URL", "配图链接")}</Label>
              <Input type="url" placeholder="https://" {...field("image_url")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-update-image_alt">{c("Image description", "配图描述")}</Label>
              <Input {...field("image_alt")} />
            </div>
            {formError && (
              <p role="alert" className="whitespace-pre-wrap text-sm text-negative sm:col-span-2">
                {formError}
              </p>
            )}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setDraft(null)}>
                {c("Cancel", "取消")}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? c("Saving…", "正在保存…") : c("Save", "保存")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={removing !== null} onOpenChange={(open) => !open && !busy && setRemoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{c("Delete this update?", "删除这条动态？")}</DialogTitle>
            <DialogDescription className="break-words">
              {removing?.title} {c("This cannot be undone.", "删除后无法恢复。")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={busy} onClick={() => setRemoving(null)}>
              {c("Cancel", "取消")}
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void remove()}>
              {c("Delete", "删除")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
