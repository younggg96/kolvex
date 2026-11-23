"use client";

import { useState } from "react";
import { useCopy } from "@/components/decision/shared";
import { PersonUpdateAvatar } from "@/components/person-updates/PersonUpdateAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isFedOfficial, personAvatar, type PersonUpdate } from "@/lib/personUpdates";

async function errorText(response: Response) {
  const raw = await response.text();
  try {
    const detail = JSON.parse(raw).detail;
    if (typeof detail === "string") return detail;
  } catch {}
  return raw || `HTTP ${response.status}`;
}

/** One portrait per person, stored apart from the updates so new imports never replace it. */
export default function PersonAvatarsEditor({
  items,
  onSaved,
}: {
  items: readonly PersonUpdate[];
  onSaved: () => Promise<void>;
}) {
  const c = useCopy();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  // Items arrive newest first, so the first entry per person is the latest one.
  const latest = new Map<string, PersonUpdate>();
  for (const item of items) if (!latest.has(item.person)) latest.set(item.person, item);
  const people = Array.from(latest.values());

  async function save(item: PersonUpdate, avatarUrl: string | null) {
    if (saving) return;
    setSaving(item.person);
    setMessage("");
    try {
      const response = await fetch("/api/admin/person-updates/avatars", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept-Language": c("en", "zh") },
        body: JSON.stringify({ person: item.person, avatar_url: avatarUrl }),
      });
      if (!response.ok) {
        setMessage(await errorText(response));
        return;
      }
      setDrafts(({ [item.person]: _, ...rest }) => rest);
      setMessage(
        avatarUrl
          ? c(`Saved ${item.person}'s portrait.`, `已保存${item.person_cn}的头像。`)
          : c(`Removed ${item.person}'s portrait.`, `已移除${item.person_cn}的头像。`),
      );
      await onSaved();
    } catch (error) {
      setMessage(
        c("Save failed.", "保存失败。") + (error instanceof Error ? ` ${error.message}` : ""),
      );
    } finally {
      setSaving(null);
    }
  }

  if (!people.length) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">{c("Portraits", "人物头像")}</h3>
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card [&>li]:px-4">
        {people.map((item) => {
          const saved = item.profile_avatar_url ?? "";
          const value = drafts[item.person] ?? saved;
          const inputId = `person-avatar-${item.person.replace(/\W+/g, "-")}`;
          const busy = saving === item.person;
          return (
            <li key={item.person} className="flex flex-wrap items-center gap-3 py-3">
              <PersonUpdateAvatar
                label={item.person_cn}
                src={value.trim() || personAvatar(item)}
                fedOfficial={isFedOfficial(item)}
                className="size-10 shrink-0"
              />
              <form
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void save(item, value.trim() || null);
                }}
              >
                <Label htmlFor={inputId} className="w-full text-sm font-medium sm:w-32 sm:shrink-0">
                  {c(item.person, item.person_cn)}
                </Label>
                <Input
                  id={inputId}
                  type="url"
                  placeholder="https://upload.wikimedia.org/…"
                  value={value}
                  disabled={saving !== null}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [item.person]: event.target.value }))
                  }
                  className="min-w-0 flex-1 basis-56"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving !== null || value.trim() === saved}
                >
                  {busy ? c("Saving…", "正在保存…") : c("Save", "保存")}
                </Button>
                {saved && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={saving !== null}
                    onClick={() => void save(item, null)}
                  >
                    {c("Remove", "移除")}
                  </Button>
                )}
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
