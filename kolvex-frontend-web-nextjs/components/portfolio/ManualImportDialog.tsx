"use client";

import React, { useMemo, useState } from "react";
import { Check, ClipboardPaste, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InfoTip } from "@/components/ui/info-tip";
import { Textarea } from "@/components/ui/textarea";
import { importManualHoldings } from "@/lib/portfolioApi";
import {
  buildManualImportPrompt,
  parseManualImport,
  summarizeManualImport,
  type ManualImportIssue,
} from "@/lib/portfolioManualImport";
import { useTranslation } from "@/lib/i18n";

interface ManualImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void> | void;
}

export function ManualImportDialog({ open, onOpenChange, onImported }: ManualImportDialogProps) {
  const { t, locale } = useTranslation();
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [importing, setImporting] = useState(false);

  const prompt = useMemo(() => buildManualImportPrompt(locale), [locale]);
  const parsed = useMemo(() => (input.trim() ? parseManualImport(input) : null), [input]);
  const summary = parsed?.ok ? summarizeManualImport(parsed.payload) : null;

  const describeIssue = (issue: ManualImportIssue) =>
    t(`portfolio.manualImport.issues.${issue.code}`, {
      account: issue.account ?? "",
      symbol: issue.symbol ?? "",
      field: issue.field ?? "",
    });

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowPrompt(true);
      toast.error(t("portfolio.manualImport.copyFailed"));
    }
  };

  const handlePaste = async () => {
    try {
      setInput(await navigator.clipboard.readText());
    } catch {
      toast.error(t("portfolio.manualImport.pasteFailed"));
    }
  };

  const handleImport = async () => {
    if (!parsed?.ok) return;
    setImporting(true);
    try {
      const result = await importManualHoldings(parsed.payload);
      toast.success(
        t("portfolio.manualImport.success", {
          accounts: String(result.accounts_count),
          positions: String(result.positions_count),
        }),
      );
      if (result.unpriced_symbols.length > 0) {
        toast.warning(
          t("portfolio.manualImport.unpriced", { symbols: result.unpriced_symbols.join(", ") }),
        );
      }
      setInput("");
      onOpenChange(false);
      await onImported();
    } catch (error) {
      toast.error(
        t("portfolio.manualImport.failed", {
          error: error instanceof Error ? error.message : "",
        }),
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !importing && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            {t("portfolio.manualImport.title")}
            <InfoTip label={t("portfolio.manualImport.aboutLabel")}>
              {t("portfolio.manualImport.about")}
            </InfoTip>
          </DialogTitle>
        </DialogHeader>

        <ol className="min-w-0 space-y-5">
          <li className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{t("portfolio.manualImport.step1")}</p>
              <Button
                variant="outline"
                size="xs"
                className="shrink-0 gap-1.5"
                onClick={handleCopyPrompt}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied
                  ? t("portfolio.manualImport.copied")
                  : t("portfolio.manualImport.copyPrompt")}
              </Button>
            </div>
            <Button
              variant="text"
              className="mt-1.5 text-xs text-muted-foreground"
              onClick={() => setShowPrompt((value) => !value)}
              aria-expanded={showPrompt}
            >
              {showPrompt
                ? t("portfolio.manualImport.hidePrompt")
                : t("portfolio.manualImport.showPrompt")}
            </Button>
            {showPrompt && (
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-foreground/[0.05] p-3 text-xs leading-5 text-muted-foreground">
                {prompt}
              </pre>
            )}
          </li>

          <li className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="manual-import-json" className="text-sm font-medium">
                {t("portfolio.manualImport.step2")}
              </label>
              <Button variant="ghost" size="xs" className="shrink-0 gap-1.5" onClick={handlePaste}>
                <ClipboardPaste className="h-3.5 w-3.5" />
                {t("portfolio.manualImport.paste")}
              </Button>
            </div>
            <Textarea
              id="manual-import-json"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("portfolio.manualImport.placeholder")}
              spellCheck={false}
              className="mt-2 h-40 font-mono text-xs"
            />

            {parsed && !parsed.ok && (
              <ul className="mt-2 space-y-1 text-xs text-negative" role="alert">
                {parsed.issues.slice(0, 6).map((issue, index) => (
                  <li key={index}>{describeIssue(issue)}</li>
                ))}
                {parsed.issues.length > 6 && (
                  <li>
                    {t("portfolio.manualImport.moreIssues", {
                      count: String(parsed.issues.length - 6),
                    })}
                  </li>
                )}
              </ul>
            )}

            {parsed?.ok && summary && (
              <div className="mt-3 space-y-2 text-xs">
                <p className="font-medium text-foreground">
                  {t("portfolio.manualImport.summary", {
                    accounts: String(summary.accounts),
                    positions: String(summary.positions),
                    options: String(summary.options),
                  })}
                </p>
                <p className="break-words font-mono text-muted-foreground">
                  {summary.symbols.slice(0, 30).join(" · ")}
                  {summary.symbols.length > 30 ? " …" : ""}
                </p>
                {summary.withoutPrice > 0 && (
                  <p className="text-muted-foreground">
                    {t("portfolio.manualImport.livePrice", { count: String(summary.withoutPrice) })}
                  </p>
                )}
                {parsed.notes.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                    {parsed.notes.map((note, index) => (
                      <li key={index}>{note}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        </ol>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleImport} disabled={!parsed?.ok || importing} className="gap-2">
            {importing && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("portfolio.manualImport.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
