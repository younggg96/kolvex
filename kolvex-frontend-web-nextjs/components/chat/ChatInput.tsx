"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Globe,
  ChevronDown,
  Sparkles,
  Check,
  Briefcase,
  Landmark,
  Lock,
  Settings,
  Square,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  ChatInputProps,
  SearchSource,
  AIModel,
  AIModelConfig,
} from "./types";

// Model configurations
export const MODEL_CONFIGS: AIModelConfig[] = [
  // ---- DeepSeek (默认, 性价比高) ----
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    provider: "DeepSeek",
    description: "Cost effective, default",
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    description: "Advanced reasoning",
    isPro: true,
  },
  // ---- OpenAI ----
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    description: "Most capable OpenAI model",
    isPro: true,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    description: "Fast and efficient",
  },
  // ---- Anthropic (Claude 4.x) ----
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "Anthropic",
    description: "Most intelligent model",
    isPro: true,
  },
  {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    provider: "Anthropic",
    description: "Speed & intelligence balance",
    isPro: true,
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    description: "Fastest Claude model",
  },
  // ---- Google Gemini ----
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    description: "Most capable Google model",
    isPro: true,
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    description: "Fast and latest",
  },
  // ---- Qwen ----
  {
    id: "qwen-max",
    name: "Qwen Max",
    provider: "Qwen",
    description: "Alibaba's most powerful",
    isPro: true,
  },
  {
    id: "qwen-plus",
    name: "Qwen Plus",
    provider: "Qwen",
    description: "Balanced performance",
  },
  // ---- Kimi (Moonshot) ----
  {
    id: "moonshot-v1-128k",
    name: "Kimi 128K",
    provider: "Kimi",
    description: "Ultra-long context",
    isPro: true,
  },
  {
    id: "moonshot-v1-8k",
    name: "Kimi 8K",
    provider: "Kimi",
    description: "Fast Kimi model",
  },
  // ---- Grok (xAI) ----
  {
    id: "grok-3",
    name: "Grok 3",
    provider: "xAI",
    description: "xAI flagship model",
    isPro: true,
  },
  {
    id: "grok-3-fast",
    name: "Grok 3 Fast",
    provider: "xAI",
    description: "Fast Grok model",
  },
];

// Map frontend display provider name → backend provider ID
export const PROVIDER_NAME_TO_ID: Record<string, string> = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  DeepSeek: "deepseek",
  Google: "gemini",
  Qwen: "qwen",
  Kimi: "kimi",
  xAI: "grok",
};

/** Get the first available model ID from available provider IDs (for default selection) */
export function getFirstAvailableModelId(
  availableProviders: string[] | undefined
): AIModel | null {
  if (!availableProviders || availableProviders.length === 0) return null;
  const first = MODEL_CONFIGS.find((m) => {
    const id = PROVIDER_NAME_TO_ID[m.provider];
    return id ? availableProviders.includes(id) : false;
  });
  return first ? (first.id as AIModel) : null;
}

interface SourceChipProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function SourceChip({ icon, label, active, onClick }: SourceChipProps) {
  return (
    <Button
      variant="ghost"
      size="xs"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0",
        active
          ? "bg-foreground/[0.08] text-foreground"
          : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
      )}
      aria-pressed={active}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

// Model Selector Component
function ModelSelector({
  selectedModel,
  onSelectModel,
  availableProviders,
}: {
  selectedModel: AIModel;
  onSelectModel: (model: AIModel) => void;
  availableProviders?: string[];
}) {
  const { t } = useTranslation();
  const currentModel = MODEL_CONFIGS.find((m) => m.id === selectedModel);

  // Check if a model's provider is available
  const isModelAvailable = (model: AIModelConfig): boolean => {
    if (!availableProviders) return true; // Still loading → show all as enabled
    const backendId = PROVIDER_NAME_TO_ID[model.provider];
    return backendId ? availableProviders.includes(backendId) : false;
  };

  const hasAnyAvailable =
    !availableProviders || MODEL_CONFIGS.some((m) => isModelAvailable(m));

  const isCurrentModelAvailable = currentModel
    ? isModelAvailable(currentModel)
    : false;

  const triggerLabel = !hasAnyAvailable
    ? t("chat.input.addApiKey")
    : isCurrentModelAvailable
      ? currentModel?.name
      : t("chat.input.selectModel");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium",
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0",
            !hasAnyAvailable
              ? "text-muted-foreground"
              : "text-foreground hover:bg-foreground/[0.05] data-[state=open]:bg-foreground/[0.05]"
          )}
        >
          {hasAnyAvailable ? (
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className="hidden sm:inline">
            {triggerLabel}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-52 max-h-72 overflow-y-auto"
      >
        {/* Prompt when no API keys configured */}
        {!hasAnyAvailable && (
          <div className="px-3 py-3 text-center">
            <Lock className="w-4 h-4 mx-auto mb-1.5 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground mb-2">
              {t("chat.input.apiKeyRequiredDesc")}
            </p>
            <Link
              href="/dashboard/settings?tab=api-keys"
              className="inline-flex items-center gap-1 text-[11px] text-positive hover:underline font-medium"
            >
              <Settings className="w-3 h-3" />
              {t("chat.input.settingsApiKeys")}
            </Link>
          </div>
        )}

        {MODEL_CONFIGS.map((model) => {
          const available = isModelAvailable(model);

          return (
            <DropdownMenuItem
              key={model.id}
              onClick={() => available && onSelectModel(model.id)}
              disabled={!available}
              className={cn(
                "flex items-center gap-2",
                available ? "cursor-pointer" : "cursor-not-allowed opacity-40",
                selectedModel === model.id && available && "bg-accent"
              )}
            >
              {available ? (
                <Check
                  className={cn(
                    "w-3 h-3 flex-shrink-0 text-positive",
                    selectedModel === model.id ? "opacity-100" : "opacity-0"
                  )}
                />
              ) : (
                <Lock className="w-3 h-3 flex-shrink-0 text-muted-foreground/50" />
              )}
              <span
                className={cn(
                  "text-xs flex-1",
                  !available
                    ? "text-muted-foreground/50"
                    : selectedModel === model.id
                      ? "font-semibold text-foreground"
                      : "text-foreground"
                )}
              >
                {model.name}
              </span>
              {model.isPro && available && (
                <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  Pro
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Shared Send Button Component
function SendButton({
  disabled,
  isLoading,
  onCancel,
  className,
}: {
  disabled: boolean;
  isLoading?: boolean;
  onCancel?: () => void;
  className?: string;
}) {
  if (isLoading && onCancel) {
    return (
      <Button
        type="button"
        onClick={onCancel}
        size="icon"
        variant="outline"
        className={cn("h-9 w-9 flex-shrink-0 rounded-full border-border", className)}
        aria-label="Stop generating"
        title="Stop generating"
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </Button>
    );
  }

  return (
    <Button
      type="submit"
      disabled={disabled}
      size="icon"
      className={cn(
        "h-9 w-9 flex-shrink-0 rounded-full transition-colors duration-150",
        "bg-primary text-primary-foreground hover:brightness-95",
        "disabled:bg-foreground/[0.08] disabled:text-muted-foreground disabled:opacity-100",
        className
      )}
      aria-label="Send"
    >
      <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
    </Button>
  );
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  onKeyDown,
  isLoading = false,
  isFocused = false,
  onFocus,
  onBlur,
  placeholder = "Ask anything about stocks, markets, or investments...",
  activeSources = ["plaid", "portfolio"],
  onToggleSource,
  showSourceToggle = true,
  inputRef: externalRef,
  selectedModel = "deepseek-chat",
  onSelectModel,
  showModelSelector = true,
  availableProviders,
}: ChatInputProps) {
  const { t } = useTranslation();
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = externalRef || internalRef;

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef?.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [value, inputRef]);

  const sourceConfig: {
    source: SearchSource;
    icon: React.ReactNode;
    label: string;
  }[] = [
    {
      source: "plaid",
      icon: <Landmark className="w-3.5 h-3.5" />,
      label: "Plaid",
    },
    {
      source: "web",
      icon: <Globe className="w-3.5 h-3.5" />,
      label: t("chat.input.sources.web"),
    },
    {
      source: "portfolio",
      icon: <Briefcase className="w-3.5 h-3.5" />,
      label: t("chat.input.sources.portfolio"),
    },
  ];

  const hasFooter =
    (showSourceToggle && onToggleSource) ||
    (showModelSelector && onSelectModel);

  // Check if current model's provider is available
  const isCurrentModelAvailable = (() => {
    if (!availableProviders) return true; // still loading
    const currentConfig = MODEL_CONFIGS.find((m) => m.id === selectedModel);
    if (!currentConfig) return false;
    const backendId = PROVIDER_NAME_TO_ID[currentConfig.provider];
    return backendId ? availableProviders.includes(backendId) : false;
  })();

  const hasAnyModel =
    !availableProviders ||
    availableProviders.length === 0
      ? false
      : MODEL_CONFIGS.some((m) => {
          const bid = PROVIDER_NAME_TO_ID[m.provider];
          return bid ? availableProviders.includes(bid) : false;
        });

  // Auto-select first available model if current is unavailable
  useEffect(() => {
    if (
      availableProviders &&
      availableProviders.length > 0 &&
      !isCurrentModelAvailable &&
      onSelectModel
    ) {
      const firstAvailable = MODEL_CONFIGS.find((m) => {
        const bid = PROVIDER_NAME_TO_ID[m.provider];
        return bid ? availableProviders.includes(bid) : false;
      });
      if (firstAvailable) {
        onSelectModel(firstAvailable.id);
      }
    }
  }, [availableProviders, isCurrentModelAvailable, onSelectModel, selectedModel]);

  // Whether chat is completely blocked (no API keys)
  const isBlocked = availableProviders !== undefined && !hasAnyModel;

  // Send is disabled when: empty text, loading, or no available model
  const isSendDisabled = !value.trim() || isLoading || isBlocked;

  // Block form submit when no API keys
  const handleFormSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isBlocked) return;
    onSubmit(e);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || isBlocked) return;
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!isSendDisabled) onSubmit();
    }
  };

  return (
    <form onSubmit={handleFormSubmit}>
      {/* Need API key prompt when user has not configured any keys */}
      {availableProviders !== undefined && !hasAnyModel && (
        <div role="status" className="mb-3 rounded-2xl bg-warning/10 px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
            <div>
              <p className="text-[13px] font-semibold text-foreground">
                {t("chat.input.apiKeyRequired")}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {t("chat.input.apiKeyRequiredDesc")}{" "}
                <Link
                  href="/dashboard/settings?tab=api-keys"
                  className="font-semibold text-positive hover:underline"
                >
                  {t("chat.input.settingsApiKeys")}
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div
        className={cn(
          "relative flex flex-col overflow-hidden rounded-[26px] border bg-muted transition-colors duration-150",
          isFocused ? "border-foreground/25" : "border-transparent"
        )}
      >
        {/* Input Area */}
        <div
          className={cn("flex items-end gap-3 px-5 pt-4", hasFooter ? "pb-1" : "pb-3")}
        >
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={handleKeyDown}
            placeholder={
              isBlocked
                ? t("chat.input.addApiKeyPlaceholder")
                : placeholder
            }
            disabled={isBlocked}
            className={cn(
              "flex-1 bg-transparent resize-none outline-none",
              "text-foreground placeholder:text-muted-foreground",
              "text-base leading-relaxed min-h-[28px] max-h-[160px]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            rows={1}
          />

          {/* Send Button - inline when no footer */}
          {!hasFooter && (
            <SendButton
              disabled={isSendDisabled}
              isLoading={isLoading}
              onCancel={onCancel}
            />
          )}
        </div>

        {/* Footer - show when source toggle or model selector is enabled */}
        {hasFooter && (
          <div
            className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1"
          >
            {/* Left Side - Source Toggles & Model Selector */}
            <div className="flex min-w-0 flex-wrap items-center gap-0.5">
              {/* Source Toggles */}
              {showSourceToggle && onToggleSource && (
                <>
                  {sourceConfig.map(({ source, icon, label }) => (
                    <SourceChip
                      key={source}
                      icon={icon}
                      label={label}
                      active={activeSources.includes(source)}
                      onClick={() => onToggleSource(source)}
                    />
                  ))}
                </>
              )}

              {/* Divider */}
              {showSourceToggle &&
                onToggleSource &&
                showModelSelector &&
                onSelectModel && (
                  <div className="mx-1 h-4 w-px bg-foreground/15" aria-hidden />
                )}

              {/* Model Selector */}
              {showModelSelector && onSelectModel && (
                <ModelSelector
                  selectedModel={selectedModel}
                  onSelectModel={onSelectModel}
                  availableProviders={availableProviders}
                />
              )}
            </div>

            {/* Send Button */}
            <SendButton
              disabled={isSendDisabled}
              isLoading={isLoading}
              onCancel={onCancel}
            />
          </div>
        )}
      </div>
    </form>
  );
}
