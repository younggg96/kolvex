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
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        "focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
        active
          ? "bg-primary/10 text-primary border !border-primary/20"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border !border-transparent"
      )}
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
}: {
  selectedModel: AIModel;
  onSelectModel: (model: AIModel) => void;
}) {
  const currentModel = MODEL_CONFIGS.find((m) => m.id === selectedModel);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
            "focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
            "data-[state=open]:ring-0 data-[state=open]:outline-none",
            "text-muted-foreground hover:text-foreground hover:bg-muted/50 border !border-transparent"
          )}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline text-xs">
            {currentModel?.name || "Select Model"}
          </span>
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side="top"
        className="w-44 max-h-64 overflow-y-auto"
      >
        {MODEL_CONFIGS.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => onSelectModel(model.id)}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              selectedModel === model.id && "bg-accent"
            )}
          >
            <Check
              className={cn(
                "w-3 h-3 flex-shrink-0 text-primary",
                selectedModel === model.id ? "opacity-100" : "opacity-0"
              )}
            />
            <span
              className={cn(
                "text-xs",
                selectedModel === model.id
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              {model.name}
            </span>
            {model.isPro && (
              <span className="ml-auto px-1 py-0.5 text-[9px] font-medium rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                Pro
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
    {
      source: "portfolio",
      icon: <Briefcase className="w-3.5 h-3.5" />,
      label: "Portfolio",
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
