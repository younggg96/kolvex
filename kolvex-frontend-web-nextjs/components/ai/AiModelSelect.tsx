"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAvailableProviders } from "@/hooks/useAvailableProviders";
import { MODEL_CONFIGS, PROVIDER_NAME_TO_ID } from "@/lib/aiModels";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The model the user picked, limited to models whose provider has the user's own API key.
 * Falls back to the first usable model; empty while keys load or when none is configured.
 */
export function useAiModelChoice() {
  const { availableProviders, loading, refresh } = useAvailableProviders();
  const eligibleModels = MODEL_CONFIGS.filter((item) =>
    availableProviders?.includes(PROVIDER_NAME_TO_ID[item.provider]),
  );
  const [chosen, setChosen] = useState("");
  const model = eligibleModels.some((item) => item.id === chosen)
    ? chosen
    : (eligibleModels[0]?.id ?? "");
  return { model, setModel: setChosen, eligibleModels, availableProviders, loading, refresh };
}

export function aiModelName(id: string) {
  return MODEL_CONFIGS.find((item) => item.id === id)?.name ?? id;
}

/** Shared model list (`lib/aiModels.ts`); models without the user's key are disabled. */
export function AiModelSelect({
  choice,
  disabled,
  className,
}: {
  choice: ReturnType<typeof useAiModelChoice>;
  disabled?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Select
      value={choice.model}
      onValueChange={choice.setModel}
      onOpenChange={(open) => {
        if (open) void choice.refresh();
      }}
      disabled={choice.loading || disabled}
    >
      <SelectTrigger
        className={cn("h-9 w-full min-w-0 sm:w-56", className)}
        aria-label={t("common.aiModel.select")}
      >
        <SelectValue placeholder={t("common.aiModel.select")} />
      </SelectTrigger>
      <SelectContent>
        {MODEL_CONFIGS.map((item) => (
          <SelectItem
            key={item.id}
            value={item.id}
            disabled={!choice.availableProviders?.includes(PROVIDER_NAME_TO_ID[item.provider])}
          >
            {item.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
