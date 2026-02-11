"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslation } from "@/lib/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { UserPlus, Loader2, AtSign, Info } from "lucide-react";

interface RequestKOLModalProps {
  onSuccess?: () => void;
}

export function RequestKOLModal({ onSuccess }: RequestKOLModalProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanUsername = username.trim().replace(/^@/, "");
    if (!cleanUsername) {
      toast.error(t("kol.request.enterValidUsername"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/kol-tracking-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: "twitter",
          platform_user_id: cleanUsername,
          user_notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t("kol.request.failedToSubmit"));
      }

      toast.success(t("kol.request.requestSubmitted", { username: cleanUsername }), {
        description: t("kol.request.requestSubmittedDesc"),
      });

      setUsername("");
      setNotes("");
      setOpen(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("kol.request.failedToSubmit")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserPlus className="w-4 h-4" />
          {t("kol.request.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image
              src="/logo/x.svg"
              alt="X"
              width={20}
              height={20}
              className="dark:invert"
            />
            {t("kol.request.title")}
          </DialogTitle>
          <DialogDescription>
            {t("kol.request.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label
              htmlFor="username"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t("kol.request.username")} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="username"
                placeholder={t("kol.request.usernamePlaceholder")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-9"
                disabled={isSubmitting}
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("kol.request.usernameHint")}
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="notes"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t("kol.request.notes")}
            </label>
            <Textarea
              id="notes"
              placeholder={t("kol.request.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
            <Info className="w-4 h-4 text-gery-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              {t("kol.request.infoText")}
            </p>
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isSubmitting || !username.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {t("kol.request.submitting")}
              </>
            ) : (
              t("kol.request.submitRequest")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
