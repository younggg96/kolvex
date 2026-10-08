"use client";

import { FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  riskReward,
  saveThesis,
  validateThesis,
  type Thesis,
  type ThesisDraft,
} from "@/lib/decision";
import { useCopy } from "./shared";
import type { AiTechnicalAnalysis } from "@/lib/stockApi";

export default function ThesisEditor({
  ticker,
  existing,
  evidence = {},
  setup,
  onSaved,
  onClose,
}: {
  ticker: string;
  existing?: Thesis;
  evidence?: ThesisDraft["evidence"];
  setup?: AiTechnicalAnalysis["setup"];
  onSaved: (thesis: Thesis) => void;
  onClose: () => void;
}) {
  const c = useCopy();
  const [draft, setDraft] = useState<ThesisDraft>(
    existing
      ? {
          ...existing,
          evidence: {
            technical: evidence.technical ?? existing.evidence.technical,
            creators: evidence.creators ?? existing.evidence.creators,
          },
        }
      : {
          ticker,
          direction: setup?.direction ?? "bullish",
          reasoning: setup?.reason ?? "",
          entry_low: setup?.entry_low ?? null,
          entry_high: setup?.entry_high ?? null,
          invalidation: setup?.invalidation ?? null,
          target: setup?.targets[0] ?? null,
          horizon: "1–3 months",
          status: "active",
          review: "",
          evidence,
        },
  );
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const rr = riskReward(draft);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (savingRef.current) return;
    setError("");
    try {
      const valid = validateThesis(draft);
      savingRef.current = true;
      setSaving(true);
      const saved = await saveThesis(valid, existing);
      toast.success(c("Thesis saved to your journal", "已保存到决策日志"));
      onSaved(saved);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : c("Unable to save thesis", "无法保存判断"),
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  const fieldClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogTitle>
          {ticker} ·{" "}
          {existing
            ? c("Review your thesis", "复盘你的判断")
            : c("Create thesis", "创建投资判断")}
        </DialogTitle>
        <DialogDescription>
          {c(
            "Write the reason, the plan, and what would change your mind.",
            "记录理由、计划，以及什么会让你改变判断。",
          )}
        </DialogDescription>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-2 text-sm">
              <span>{c("Direction", "方向")}</span>
              <select
                className={fieldClass}
                value={draft.direction}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    direction: e.target.value as ThesisDraft["direction"],
                  })
                }
              >
                <option value="bullish">{c("Bullish", "看多")}</option>
                <option value="neutral">{c("Neutral", "中性")}</option>
                <option value="bearish">{c("Bearish", "看空")}</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span>{c("Time horizon", "投资周期")}</span>
              <Input
                required
                maxLength={100}
                value={draft.horizon}
                onChange={(e) =>
                  setDraft({ ...draft, horizon: e.target.value })
                }
              />
            </label>
          </div>
          <label className="block space-y-2 text-sm">
            <span>{c("Why I'm interested", "为什么关注这只股票")}</span>
            <textarea
              required
              maxLength={10000}
              rows={4}
              className={fieldClass}
              value={draft.reasoning}
              onChange={(e) =>
                setDraft({ ...draft, reasoning: e.target.value })
              }
              placeholder={c(
                "My thesis is… It would change if…",
                "我的判断是… 如果… 我会改变判断。",
              )}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                ["entry_low", c("Entry low ($)", "入场下限（美元）")],
                ["entry_high", c("Entry high ($)", "入场上限（美元）")],
                ["invalidation", c("Invalidation ($)", "失效价（美元）")],
                ["target", c("Target ($)", "目标价（美元）")],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="space-y-2 text-sm">
                <span>{label}</span>
                <Input
                  type="number"
                  step="any"
                  min="0.000001"
                  max="1000000000"
                  value={draft[key] ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [key]:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {c("Risk / reward", "风险收益比")}:{" "}
            {rr === null ? "—" : `1 : ${rr.toFixed(2)}`}
          </p>
          {existing && (
            <>
              <label className="block space-y-2 text-sm">
                <span>
                  {c(
                    "What changed? What did you learn?",
                    "发生了什么变化？学到了什么？",
                  )}
                </span>
                <textarea
                  rows={3}
                  maxLength={10000}
                  className={fieldClass}
                  value={draft.review}
                  onChange={(e) =>
                    setDraft({ ...draft, review: e.target.value })
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.status === "closed"}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      status: e.target.checked ? "closed" : "active",
                    })
                  }
                />
                {c("Close this thesis", "结束这条判断")}
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {c(
              "Each save preserves a version of your reasoning and available evidence.",
              "每次保存都会保留当时的理由与可用证据。",
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              {c("Cancel", "取消")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? c("Saving…", "保存中…") : c("Save thesis", "保存判断")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
