"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Languages, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsGroup, SettingsRow } from "@/components/ui/settings-group";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n";
import { clearChatMemory, getChatMemory, type ChatMemory } from "@/lib/api/chatMemoryApi";

/** View and clear what the AI chat remembers across conversations. */
export function ChatMemorySettings({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [memory, setMemory] = useState<ChatMemory | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setMemory(await getChatMemory());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearChatMemory();
      setMemory({ language: null, tickers: [], updated_at: null });
      setConfirmOpen(false);
      toast.success(t("settings.chatMemory.cleared"));
    } catch {
      toast.error(t("settings.chatMemory.clearFailed"));
    } finally {
      setClearing(false);
    }
  };

  const empty = memory !== null && !memory.language && memory.tickers.length === 0;
  const language =
    memory?.language === "zh"
      ? t("settings.chatMemory.languageZh")
      : memory?.language === "en"
        ? t("settings.chatMemory.languageEn")
        : t("settings.chatMemory.notYet");

  return (
    <SettingsGroup
      className={className}
      label={t("settings.chatMemory.title")}
      action={
        memory && !empty ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-destructive hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t("settings.chatMemory.clear")}
          </Button>
        ) : undefined
      }
    >
      <p className="px-4 py-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
        {t("settings.chatMemory.description")}
      </p>
      {failed ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 text-[0.875rem]">
          <span className="text-muted-foreground">{t("settings.chatMemory.loadFailed")}</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : memory === null ? (
        <div className="flex items-center gap-2 px-4 py-3 text-[0.875rem] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("common.loading")}
        </div>
      ) : (
        <>
          <SettingsRow icon={Languages} label={t("settings.chatMemory.language")}>
            <span className="text-[0.875rem] text-muted-foreground">{language}</span>
          </SettingsRow>
          <SettingsRow
            icon={Brain}
            label={t("settings.chatMemory.tickers")}
            stacked={memory.tickers.length > 0}
          >
            {memory.tickers.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {memory.tickers.map((ticker) => (
                  <span
                    key={ticker}
                    className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[0.8125rem] text-foreground"
                  >
                    {ticker}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-[0.875rem] text-muted-foreground">
                {t("settings.chatMemory.notYet")}
              </span>
            )}
          </SettingsRow>
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={(open) => !clearing && setConfirmOpen(open)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.chatMemory.confirmTitle")}</DialogTitle>
            <DialogDescription>{t("settings.chatMemory.confirmDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={clearing}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void handleClear()} disabled={clearing}>
              {clearing && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("settings.chatMemory.clear")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsGroup>
  );
}
