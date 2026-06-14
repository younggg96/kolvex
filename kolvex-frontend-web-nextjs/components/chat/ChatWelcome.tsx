"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
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
  { key: "chat.suggestions.reviewRobinhood", isChat: true },
  { key: "chat.suggestions.checkWashSale", isChat: true },
  { key: "chat.suggestions.latestNews", href: "/dashboard/news", isChat: false },
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
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const suggestions = suggestionKeys.map((s) => ({
    text: t(s.key),
    isChat: s.isChat,
    ...(s.href ? { href: s.href } : {}),
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
    } else if (suggestion.href) {
      router.push(suggestion.href);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6">
      {/* Welcome Section */}
      <div className="w-full max-w-2xl mx-auto text-center mb-8 animate-fade-in">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-primary/10 to-emerald-500/10 border border-primary/20 text-primary text-xs font-bold mb-6">
          {t("chat.badge")}
        </div>

        {/* Heading */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
          {(() => {
            const raw = t("chat.heading");
            const parts = raw.split(/<highlight>|<\/highlight>/);
            if (parts.length === 3) {
              return <>{parts[0]}<span className="text-primary">{parts[1]}</span>{parts[2]}</>;
            }
            return raw;
          })()}
        </h1>

        {/* Description */}
        <p className="text-gray-600 dark:text-white/60 text-sm max-w-xl mx-auto">
          {t("chat.description")}
        </p>
      </div>

      {/* Search Input */}
      <div
        className="w-full max-w-2xl mx-auto mb-8 animate-fade-in-up"
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
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
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
    </div>
  );
}
