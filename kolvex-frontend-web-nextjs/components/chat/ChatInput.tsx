"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Globe,
  ChevronDown,
  Cpu,
  Check,
  Briefcase,
  Landmark,
  Loader2,
  Lock,
  Settings,
  Square,
  X,
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

import { MODEL_CONFIGS, PROVIDER_NAME_TO_ID } from "@/lib/aiModels";
export { MODEL_CONFIGS, PROVIDER_NAME_TO_ID, getFirstAvailableModelId } from "@/lib/aiModels";

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
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium",
        " ",
        active
          ? "bg-foreground/10 text-foreground"
          : "text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1]"
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
    if (!availableProviders) return false; // Wait for user key availability
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
            "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium",
            " ",
            !hasAnyAvailable
              ? "text-muted-foreground"
              : "text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1] data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground"
          )}
        >
          {hasAnyAvailable ? (
            <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className="max-w-[55vw] truncate text-left sm:max-w-none">
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
            <p className="text-[0.6875rem] text-muted-foreground mb-2">
              {t("chat.input.apiKeyRequiredDesc")}
            </p>
            <Link
              href="/dashboard/settings?tab=api-keys"
              className="inline-flex items-center gap-1 text-[0.6875rem] text-positive hover:underline font-medium"
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
                <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[0.625rem] font-semibold text-muted-foreground">
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
        "glass-button glass-button-primary bg-primary/85 text-primary-foreground hover:bg-primary/75",
        "disabled:bg-foreground/[0.08] disabled:text-muted-foreground disabled:opacity-100",
        className
      )}
      aria-label="Send"
    >
      <ArrowUp className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.5} />
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
  onFocus,
  onBlur,
  placeholder,
  appearance = "panel",
  activeSources = ["plaid", "portfolio"],
  onToggleSource,
  showSourceToggle = true,
  inputRef: externalRef,
  selectedModel = "deepseek-flash",
  onSelectModel,
  showModelSelector = true,
  availableProviders,
  evidenceLabel,
  onClearEvidence,
  fieldClassName,
  collapsed = false,
  onExpand,
}: ChatInputProps) {
  const { t } = useTranslation();
  const inline = appearance === "inline";
  const docked = appearance === "docked";
  const prompt = placeholder ?? t("chat.input.placeholder");
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
    if (!availableProviders) return false; // still loading
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
  const isSendDisabled = !value.trim() || isLoading || isBlocked || !isCurrentModelAvailable;

  // Block form submit when no API keys
  const handleFormSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSendDisabled) return;
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
    <form noValidate onSubmit={handleFormSubmit}>
      {/* Need API key prompt when user has not configured any keys */}
      {availableProviders !== undefined && !hasAnyModel && (
        <div role="status" className="glass-track glass-track-strong mb-3 rounded-3xl px-4 py-3">
          <div className="flex items-start gap-2.5">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
            <div>
              <p className="text-[0.8125rem] font-semibold text-foreground">
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
      <div className={cn("group/composer relative", inline && "bg-transparent")}>
        {/* The glass is its own layer so it can shrink to a circle while the content keeps
            its size, and fading the content never touches the glass's backdrop blur. Same
            material, radius and rim as the mobile dock (MobileTabBar). The rim is a shadow,
            so focus brightens the shadow rather than a border. */}
        {!inline && (
          <div
            aria-hidden
            className={cn(
              "glass-track glass-track-strong absolute inset-0 rounded-[28px]",
              "[transition:top_var(--spring-standard)_var(--spring),left_var(--spring-standard)_var(--spring),box-shadow_150ms]",
              "group-focus-within/composer:[box-shadow:var(--glass-drop),inset_0_0_0_1px_rgb(var(--foreground)/0.35),var(--glass-sheen)]",
              collapsed && "max-lg:left-[calc(100%-48px)] max-lg:top-[calc(100%-48px)]"
            )}
          />
        )}
        <div
          // React 18 only writes `inert` as a string attribute, though the types say boolean.
          {...(collapsed ? { inert: "" as unknown as boolean } : {})}
          className={cn(
            "relative flex flex-col transition-opacity",
            !inline && "overflow-hidden rounded-[28px]",
            collapsed
              ? "opacity-0 duration-100"
              : "opacity-100 delay-100 duration-200"
          )}
        >
          {evidenceLabel && (
            <div
              className={cn(
                "flex items-center gap-2",
                inline ? "px-0 pb-1 pt-1" : "px-4 pt-3"
              )}
            >
              <p className="min-w-0 flex-1 truncate text-[0.8125rem] text-muted-foreground">
                <span className="font-medium text-foreground">{t("chat.evidence.using")}</span>
                <span className="px-1.5 text-foreground/30" aria-hidden>·</span>
                {evidenceLabel}
              </p>
              {onClearEvidence && (
                <button
                  type="button"
                  onClick={onClearEvidence}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none"
                  aria-label={t("chat.evidence.clear")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
          <div
            className={cn(
              // The send button floats over the end of the field when it has no footer. The
              // textarea stays in flow, so it — not an empty column — decides the row's
              // height: a multi-line value grows the composer instead of scrolling inside a
              // one-line box. The field's right inset keeps the caret clear of the button,
              // while the rows above it still use the full width.
              "relative grid items-end gap-2.5",
              hasFooter ? "grid-cols-1" : "max-md:grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto]",
              inline
                ? "pb-3 pt-1"
                : docked
                  ? "px-5 pt-3.5"
                  : cn("px-5", evidenceLabel ? "pt-1" : "pt-4", hasFooter ? "pb-1" : "pb-3")
            )}
          >
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              onKeyDown={handleKeyDown}
              placeholder={isBlocked ? t("chat.input.addApiKeyPlaceholder") : prompt}
              disabled={isBlocked}
              className={cn(
                // The global focus-visible wash is for controls, not for the field
                // being edited, so the composer stays one surface while typing.
                "col-start-1 row-start-1 block w-full min-w-0 resize-none bg-transparent outline-none",
                "text-foreground placeholder:text-muted-foreground",
                "disabled:cursor-not-allowed disabled:opacity-50",
                // On phones the button overlays the field's end, so reserve its width on the
                // last line. With a footer the button lives in the footer, leaving full width.
                !hasFooter && "max-md:pr-14",
                inline
                  ? "min-h-11 border-b-2 border-transparent text-[1.0625rem] leading-7 focus-visible:border-primary focus-visible:!bg-transparent focus-visible:outline-none"
                  : "min-h-[1.75rem] max-h-[10rem] text-base leading-relaxed focus-visible:!bg-transparent focus-visible:outline-none",
                fieldClassName
              )}
              rows={1}
            />

            {/* Send Button - floats at the field's end on phones, its own column on desktop. */}
            {!hasFooter && (
              <div className="col-start-1 row-start-1 justify-self-end self-end md:col-start-2">
                <SendButton
                  disabled={isSendDisabled}
                  isLoading={isLoading}
                  onCancel={onCancel}
                />
              </div>
            )}
          </div>

          {/* Footer - show when source toggle or model selector is enabled */}
          {hasFooter && (
            <div
              className={cn(
                "flex items-center justify-between gap-2",
                inline
                  ? "border-t border-border px-0 py-2"
                  : "px-2.5 pb-2.5 pt-1"
              )}
            >
              {/* Left Side - Source Toggles & Model Selector */}
              <div className={cn("flex min-w-0 flex-wrap items-center gap-0.5", inline && "-ml-3")}>
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

        {onExpand && (
          <div
            className={cn(
              "absolute bottom-0 right-0 transition-[opacity,transform] duration-200 lg:hidden",
              collapsed
                ? "pointer-events-auto scale-100 opacity-100 delay-100"
                : "pointer-events-none scale-50 opacity-0"
            )}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onExpand}
              tabIndex={collapsed ? 0 : -1}
              aria-hidden={!collapsed}
              aria-label={t("chat.input.expand")}
              title={t("chat.input.expand")}
              className="h-[48px] w-[48px] rounded-full text-foreground"
            >
              {isLoading ? (
                <Loader2 className="h-[1.125rem] w-[1.125rem] animate-spin" />
              ) : (
                <ArrowUp className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.5} />
              )}
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}
