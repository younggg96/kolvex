"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, Briefcase, Youtube, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ChatInput, MODEL_CONFIGS } from "./ChatInput";
import { useTranslation } from "@/lib/i18n";
import type { ChatWelcomeProps } from "./types";

const PROVIDER_NAME_TO_ID: Record<string, string> = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  DeepSeek: "deepseek",
  Google: "gemini",
  Qwen: "qwen",
  Kimi: "kimi",
  xAI: "grok",
};

const suggestionKeys = [
  { key: "chat.suggestions.askCreators", isChat: true },
  { key: "chat.suggestions.holdingsOverlap", isChat: true },
  { key: "chat.suggestions.whoShifted", isChat: true },
];

export function ChatWelcome({
  onSubmit,
  isLoading = false,
  activeSources,
  onToggleSource,
  selectedModel,
  onSelectModel,
  availableProviders,
  variant = "page",
  suggestions: suggestionOverrides,
  placeholder,
  evidenceLabel,
  onClearEvidence,
}: ChatWelcomeProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const compact = variant === "compact";

  useEffect(() => {
    if (compact) inputRef.current?.focus();
  }, [compact]);

  const suggestions = suggestionOverrides
    ? suggestionOverrides.map((text) => ({ text, isChat: true }))
    : suggestionKeys.map((s) => ({
        text: t(s.key),
        isChat: s.isChat,
      }));

  // Whether the user has any usable model
  const hasAnyModel =
    availableProviders !== undefined &&
    availableProviders.length > 0 &&
    MODEL_CONFIGS.some((m) => {
      const bid = PROVIDER_NAME_TO_ID[m.provider];
      return bid ? availableProviders.includes(bid) : false;
    });

  const isBlocked = availableProviders !== undefined && !hasAnyModel;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isBlocked || isLoading) return;
    if (query.trim()) {
      onSubmit(query.trim());
      setQuery("");
    }
  };

  const handleSuggestionClick = (suggestion: (typeof suggestions)[0]) => {
    if (suggestion.isChat) {
      if (isBlocked || isLoading) return;
      onSubmit(suggestion.text);
    }
  };

  const input = (
    <ChatInput
      value={query}
      onChange={setQuery}
      onSubmit={handleSubmit}
      isLoading={isLoading}
      isFocused={isFocused}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      placeholder={placeholder ?? t("chat.input.placeholder")}
      appearance={compact ? "inline" : "panel"}
      activeSources={activeSources}
      onToggleSource={onToggleSource}
      showSourceToggle={true}
      showModelSelector={!!onSelectModel}
      selectedModel={selectedModel}
      onSelectModel={onSelectModel}
      inputRef={inputRef}
      availableProviders={availableProviders}
      evidenceLabel={evidenceLabel}
      onClearEvidence={onClearEvidence}
    />
  );

  if (compact) {
    return (
      <div className="flex w-full flex-col gap-4 pt-3">
        {input}
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.text}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={isBlocked || isLoading}
              className="rounded-full border border-border px-3 py-1.5 text-left text-[13px] text-muted-foreground transition-colors duration-150 hover:border-foreground/30 hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {suggestion.text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-10 md:px-8">
      <div className="mx-auto mb-8 w-full max-w-2xl animate-fade-in">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.01em] text-foreground md:text-[32px]">
          {(() => {
            const raw = t("chat.heading");
            const parts = raw.split(/<highlight>|<\/highlight>/);
            if (parts.length === 3) {
              return <>{parts[0]}{parts[1]}{parts[2]}</>;
            }
            return raw;
          })()}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          {t("chat.description")}
        </p>
      </div>

      <div
        className="mx-auto w-full max-w-2xl animate-fade-in-up"
        style={{ animationDelay: "100ms" }}
      >
        {input}

        <ul className="mt-6 divide-y divide-border border-y border-border">
          {suggestions.map((suggestion, index) => (
            <li key={index}>
              <button
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={suggestion.isChat && (isBlocked || isLoading)}
                className="group flex w-full items-center gap-3 py-3.5 text-left text-[15px] transition-colors duration-150 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">{suggestion.text}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
          {[
            { href: "/dashboard/youtube-opinions", icon: Youtube, label: t("chat.suggestions.compareOpinions") },
            { href: "/dashboard/portfolio", icon: Briefcase, label: t("chat.suggestions.reviewPortfolio") },
          ].map(({ href, icon: Icon, label }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex min-w-0 items-center gap-3 py-3.5 text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1">{label}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
