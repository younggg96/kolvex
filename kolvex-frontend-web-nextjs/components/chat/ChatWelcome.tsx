"use client";

import { useState, useRef, useEffect } from "react";
import { Zap, Briefcase, Youtube, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ChipButton } from "@/components/ui/chip-button";
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
  { key: "chat.suggestions.reviewPortfolio", isChat: true },
  { key: "chat.suggestions.checkWashSale", isChat: true },
];

export function ChatWelcome({
  onSubmit,
  isLoading = false,
  activeSources,
  onToggleSource,
  selectedModel,
  onSelectModel,
  availableProviders,
}: ChatWelcomeProps) {
  const { t, locale } = useTranslation();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestions = suggestionKeys.map((s) => ({
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
    if (isBlocked) return;
    if (query.trim()) {
      onSubmit(query.trim());
      setQuery("");
    }
  };

  const handleSuggestionClick = (suggestion: (typeof suggestions)[0]) => {
    if (suggestion.isChat) {
      if (isBlocked) return;
      onSubmit(suggestion.text);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-10 md:px-8">
      {/* Welcome Section */}
      <div className="mx-auto mb-8 w-full max-w-2xl text-left animate-fade-in">
        {/* Badge */}
        <div className="mb-4 text-sm font-medium text-muted-foreground">
          {t("chat.badge")}
        </div>

        {/* Heading */}
        <h1 className="mb-4 text-2xl font-medium leading-snug text-foreground md:text-3xl">
          {(() => {
            const raw = t("chat.heading");
            const parts = raw.split(/<highlight>|<\/highlight>/);
            if (parts.length === 3) {
              return <>{parts[0]}{parts[1]}{parts[2]}</>;
            }
            return raw;
          })()}
        </h1>

        {/* Description */}
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t("chat.description")}
        </p>
      </div>

      {/* Search Input */}
      <div
        className="mx-auto mb-8 w-full max-w-2xl animate-fade-in-up"
        style={{ animationDelay: "100ms" }}
      >
        <ChatInput
          value={query}
          onChange={setQuery}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          isFocused={isFocused}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          activeSources={activeSources}
          onToggleSource={onToggleSource}
          showSourceToggle={true}
          showModelSelector={!!onSelectModel}
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
          inputRef={inputRef}
          availableProviders={availableProviders}
        />

        {/* Quick Suggestions — only chat suggestions are blocked when no key */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {suggestions.map((suggestion, index) => (
            <ChipButton
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={suggestion.isChat && isBlocked}
              icon={<Zap className="w-3 h-3 text-primary/70" />}
            >
              {suggestion.text}
            </ChipButton>
          ))}
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-2xl gap-4 border-t border-border pt-5 sm:grid-cols-2">
        {[
          { href: "/dashboard/youtube-opinions", icon: Youtube, label: locale === "zh" ? "比较博主股票观点" : "Compare creator opinions" },
          { href: "/dashboard/portfolio", icon: Briefcase, label: locale === "zh" ? "查看投资组合" : "Review your portfolio" },
        ].map(({ href, icon: Icon, label }) => <Link key={href} href={href} className="flex min-w-0 items-center gap-3 rounded-md py-3 text-sm hover:text-primary"><Icon className="h-5 w-5 shrink-0 text-muted-foreground" /><span className="flex-1">{label}</span><ArrowUpRight className="h-4 w-4 shrink-0" /></Link>)}
      </div>
    </div>
  );
}
