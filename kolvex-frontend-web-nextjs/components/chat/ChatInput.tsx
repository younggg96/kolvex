"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Users,
  Newspaper,
  Globe,
  ChevronDown,
  Sparkles,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type {
  ChatInputProps,
  SearchSource,
  AIModel,
  AIModelConfig,
} from "./types";

// Model configurations
const MODEL_CONFIGS: AIModelConfig[] = [
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
  {
    id: "claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    description: "Best for analysis",
    isPro: true,
  },
  {
    id: "claude-3.5-haiku",
    name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    description: "Fast responses",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    description: "Latest Google model",
  },
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "Google",
    description: "Long context window",
    isPro: true,
  },
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    provider: "DeepSeek",
    description: "Cost effective",
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    description: "Advanced reasoning",
    isPro: true,
  },
];

// Get provider color
function getProviderColor(provider: AIModelConfig["provider"]) {
  switch (provider) {
    case "OpenAI":
      return "text-emerald-600 dark:text-emerald-400";
    case "Anthropic":
      return "text-orange-600 dark:text-orange-400";
    case "Google":
      return "text-blue-600 dark:text-blue-400";
    case "DeepSeek":
      return "text-purple-600 dark:text-purple-400";
    default:
      return "text-muted-foreground";
  }
}

interface SourceChipProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

function SourceChip({ icon, label, active, onClick }: SourceChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
        active
          ? "bg-primary/10 text-primary border border-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// Model Selector Component
function ModelSelector({
  selectedModel,
  onSelectModel,
}: {
  selectedModel: AIModel;
  onSelectModel: (model: AIModel) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModel = MODEL_CONFIGS.find((m) => m.id === selectedModel);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          "border border-transparent hover:border-border-light dark:hover:border-border-dark",
          isOpen && "bg-muted/50 text-foreground"
        )}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">
          {currentModel?.name || "Select Model"}
        </span>
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute bottom-full left-0 mb-2 w-64 max-h-80 overflow-y-auto",
            "bg-white dark:bg-card-dark rounded-xl border border-border-light dark:border-border-dark",
            "shadow-xl shadow-black/10 dark:shadow-black/30",
            "animate-fade-in z-50"
          )}
        >
          <div className="p-1.5">
            {MODEL_CONFIGS.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => {
                  onSelectModel(model.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150",
                  "hover:bg-muted/50 dark:hover:bg-white/5",
                  selectedModel === model.id &&
                    "bg-primary/5 dark:bg-primary/10"
                )}
              >
                {/* Selection Indicator */}
                <div className="flex-shrink-0 mt-0.5">
                  {selectedModel === model.id ? (
                    <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>

                {/* Model Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        selectedModel === model.id
                          ? "text-foreground"
                          : "text-foreground/80"
                      )}
                    >
                      {model.name}
                    </span>
                    {model.isPro && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Pro
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={cn(
                        "text-[11px] font-medium",
                        getProviderColor(model.provider)
                      )}
                    >
                      {model.provider}
                    </span>
                    {model.description && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-[11px] text-muted-foreground">
                          {model.description}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Shared Send Button Component
function SendButton({
  disabled,
  className,
}: {
  disabled: boolean;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      disabled={disabled}
      size="icon"
      className={cn(
        "h-8 w-8 rounded-xl flex-shrink-0 transition-all duration-200",
        "bg-primary text-white shadow-sm shadow-primary/20",
        "hover:bg-primary/90 hover:shadow-md hover:shadow-primary/25",
        "disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
        "disabled:dark:bg-white/5 disabled:dark:text-white/25",
        className
      )}
    >
      <Send className="w-4 h-4" />
    </Button>
  );
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  isLoading = false,
  isFocused = false,
  onFocus,
  onBlur,
  placeholder = "Ask anything about stocks, markets, or investments...",
  activeSources = ["kol"],
  onToggleSource,
  showSourceToggle = true,
  inputRef: externalRef,
  selectedModel = "gpt-4o-mini",
  onSelectModel,
  showModelSelector = true,
}: ChatInputProps) {
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
      source: "kol",
      icon: <Users className="w-3.5 h-3.5" />,
      label: "KOL",
    },
    {
      source: "news",
      icon: <Newspaper className="w-3.5 h-3.5" />,
      label: "News",
    },
    {
      source: "web",
      icon: <Globe className="w-3.5 h-3.5" />,
      label: "Web",
    },
  ];

  const hasFooter =
    (showSourceToggle && onToggleSource) ||
    (showModelSelector && onSelectModel);

  return (
    <form onSubmit={onSubmit}>
      {/* Main Container */}
      <div
        className={cn(
          "relative flex flex-col rounded-2xl border overflow-hidden transition-all duration-200",
          "bg-white dark:bg-card-dark/80 backdrop-blur-sm",
          isFocused
            ? "border-primary/20 ring-1 ring-primary/10 shadow-lg shadow-black/5 dark:shadow-black/20"
            : "border-border-light dark:border-border-dark"
        )}
      >
        {/* Input Area */}
        <div
          className={cn("flex items-end gap-3 px-4 py-3", hasFooter && "pb-2")}
        >
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            className={cn(
              "flex-1 bg-transparent resize-none outline-none",
              "text-foreground placeholder:text-muted-foreground/50",
              "text-[15px] leading-relaxed min-h-[28px] max-h-[120px]",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            rows={1}
          />

          {/* Send Button - inline when no footer */}
          {!hasFooter && <SendButton disabled={!value.trim() || isLoading} />}
        </div>

        {/* Footer - show when source toggle or model selector is enabled */}
        {hasFooter && (
          <div
            className={cn(
              "flex items-center justify-between gap-2 px-4 py-2.5",
              "border-t border-border-light/50 dark:border-border-dark/50",
              "bg-muted/30 dark:bg-white/[0.02]"
            )}
          >
            {/* Left Side - Source Toggles & Model Selector */}
            <div className="flex items-center gap-1 flex-wrap">
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
                  <div className="w-px h-4 bg-border-light dark:bg-border-dark mx-1" />
                )}

              {/* Model Selector */}
              {showModelSelector && onSelectModel && (
                <ModelSelector
                  selectedModel={selectedModel}
                  onSelectModel={onSelectModel}
                />
              )}
            </div>

            {/* Send Button */}
            <SendButton disabled={!value.trim() || isLoading} />
          </div>
        )}
      </div>
    </form>
  );
}
