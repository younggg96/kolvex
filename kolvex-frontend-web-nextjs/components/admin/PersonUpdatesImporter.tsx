"use client";

import { useRef, useState } from "react";
import { useCopy } from "@/components/decision/shared";
import { PersonUpdateTimeline } from "@/components/person-updates/PersonUpdateTimeline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PersonUpdate } from "@/lib/personUpdates";

export default function PersonUpdatesImporter() {
  const c = useCopy();
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [preview, setPreview] = useState<PersonUpdate[]>([]);
  const [busy, setBusy] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);

  async function submit(validate: boolean) {
    if (inFlight.current) return;
    setPreview([]);
    inFlight.current = true;
    setBusy(true);
    setResult(validate ? c("Validating…", "正在校验…") : c("Saving…", "正在保存…"));

    try {
      const response = await fetch(`/api/admin/person-updates${validate ? "?validate=1" : ""}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Language": c("en", "zh") },
        body: input,
      });
      if (!response.ok) {
        const raw = await response.text();
        const detail = response.headers.get("Content-Type")?.includes("application/json")
          ? JSON.parse(raw).detail
          : undefined;
        setResult(typeof detail === "string" ? detail : raw || `HTTP ${response.status}`);
        return;
      }
      if (validate) {
        const data: { items: PersonUpdate[] } = await response.json();
        setPreview(data.items);
        setResult(
          c(
            `Validation passed for ${data.items.length} item(s).`,
            `已通过校验 ${data.items.length} 条。`,
          ),
        );
      } else {
        const data: { count: number; ids: string[] } = await response.json();
        setResult(
          c(
            `Saved ${data.count} item(s): ${data.ids.join(", ")}`,
            `已保存 ${data.count} 条：${data.ids.join("，")}`,
          ),
        );
      }
    } catch (error) {
      setResult(
        c("Import request failed", "导入请求失败") +
          (error instanceof Error ? `\n${error.message}` : ""),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Textarea
        ref={textarea}
        aria-label={c("Person updates JSON", "人物动态 JSON")}
        placeholder={c("Paste JSON", "粘贴 JSON")}
        spellCheck={false}
        value={input}
        readOnly={busy}
        rows={12}
        className="font-mono"
        onChange={(event) => {
          setInput(event.target.value);
          setPreview([]);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => void submit(true)}>
          {c("校验并预览 · Validate and preview", "校验并预览")}
        </Button>
        <Button type="button" disabled={busy} onClick={() => void submit(false)}>
          {c("保存 · Save", "保存")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setInput("");
            setResult("");
            setPreview([]);
            textarea.current?.focus();
          }}
        >
          {c("清空 · Clear", "清空")}
        </Button>
      </div>
      <div
        className="space-y-4 rounded-xl border border-border p-4"
        aria-label={c("Import result", "导入结果")}
      >
        <p role="status" className="m-0 whitespace-pre-wrap break-words text-sm">
          {result ||
            c(
              "Use avatar_url for a portrait and image_url with image_alt for an event photo. Use HTTPS image links.",
              "头像填写 avatar_url，事件配图填写 image_url 和 image_alt。图片链接使用 HTTPS。",
            )}
        </p>
        {preview.length > 0 && <PersonUpdateTimeline items={preview} />}
      </div>
    </div>
  );
}
