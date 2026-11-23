"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { FileUp } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { PersonUpdateTimeline } from "@/components/person-updates/PersonUpdateTimeline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PersonUpdate } from "@/lib/personUpdates";

const MAX_JSON_BYTES = 2 * 1024 * 1024;

export default function PersonUpdatesImporter({
  busy,
  onBusyChange,
  onSaved,
}: {
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const c = useCopy();
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [preview, setPreview] = useState<PersonUpdate[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const inFlight = useRef(false);

  function updateInput(value: string) {
    setInput(value);
    setResult("");
    setFileName("");
    setFileError("");
    setPreview([]);
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || busy || inFlight.current) return;
    setFileError("");
    if (!file.name.toLowerCase().endsWith(".json") || file.size > MAX_JSON_BYTES) {
      setFileError(c("Choose a .json file up to 2 MB.", "请选择 2 MB 以内的 .json 文件。"));
      return;
    }

    inFlight.current = true;
    onBusyChange(true);
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      JSON.parse(text);
      updateInput(text);
      setFileName(file.name);
      textarea.current?.focus();
    } catch {
      setFileError(c("Choose a valid UTF-8 JSON file.", "请选择格式正确的 UTF-8 JSON 文件。"));
    } finally {
      inFlight.current = false;
      onBusyChange(false);
    }
  }

  async function submit(validate: boolean) {
    if (busy || inFlight.current || !input.trim()) return;
    setFileError("");
    setPreview([]);
    inFlight.current = true;
    onBusyChange(true);
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
        await onSaved();
      }
    } catch (error) {
      setResult(
        c("Import request failed", "导入请求失败") +
          (error instanceof Error ? `\n${error.message}` : ""),
      );
    } finally {
      inFlight.current = false;
      onBusyChange(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={selectFile}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            aria-describedby="person-updates-json-help"
            onClick={() => fileInput.current?.click()}
          >
            <FileUp className="size-4" aria-hidden />
            {c("Choose JSON file", "选择 JSON 文件")}
          </Button>
          <span role="status" className="min-w-0 break-all text-sm text-muted-foreground">
            {fileName && c(`Loaded ${fileName}`, `已载入 ${fileName}`)}
          </span>
        </div>
        <p id="person-updates-json-help" className="text-xs text-muted-foreground">
          {c(
            "UTF-8 JSON up to 2 MB. Saving replaces existing updates with matching IDs.",
            "支持 2 MB 以内的 UTF-8 JSON。保存会覆盖 ID 相同的动态。",
          )}
        </p>
        {fileError && (
          <p role="alert" className="text-sm text-negative">
            {fileError}
          </p>
        )}
      </div>
      <Textarea
        ref={textarea}
        aria-label={c("Updates JSON", "动态 JSON")}
        placeholder={c("Paste JSON", "粘贴 JSON")}
        spellCheck={false}
        value={input}
        readOnly={busy}
        rows={12}
        className="!resize-none font-mono"
        onChange={(event) => updateInput(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={busy || !input.trim()}
          onClick={() => void submit(true)}
        >
          {c("Validate and preview", "校验并预览")}
        </Button>
        <Button type="button" disabled={busy || !input.trim()} onClick={() => void submit(false)}>
          {c("Save", "保存")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            updateInput("");
            textarea.current?.focus();
          }}
        >
          {c("Clear", "清空")}
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
