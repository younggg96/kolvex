"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, Briefcase, Youtube, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ChatInput, MODEL_CONFIGS } from "./ChatInput";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ChatWelcomeProps } from "./types";
import { Button } from "@/components/ui/button";

const PROVIDER_NAME_TO_ID: Record<string, string> = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  DeepSeek: "deepseek",
  Google: "gemini",
  Qwen: "qwen",
  Kimi: "kimi",
  xAI: "grok",
};

/** Questions that ask the assistant; the two page links sit beside the composer. */
const suggestionKeys = [
  "chat.suggestions.askCreators",
  "chat.suggestions.holdingsOverlap",
  "chat.suggestions.whoShifted",
];

/** Pages worth opening from the chat page, shown as chips beside the composer. */
const referenceLinks = [
  { href: "/dashboard/youtube-opinions", icon: Youtube, key: "chat.suggestions.compareOpinions" },
  { href: "/dashboard/portfolio", icon: Briefcase, key: "chat.suggestions.reviewPortfolio" },
];

type Suggestion = { text: string; isChat: boolean };

export function ChatWelcome({
  onSubmit,
  isLoading = false,
  activeSources,
  onToggleSource,
  activeSkills,
  onToggleSkill,
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
  const dock = variant === "dock";

  useEffect(() => {
    if (compact) inputRef.current?.focus();
  }, [compact]);

  const suggestions: Suggestion[] = (
    suggestionOverrides ?? suggestionKeys.map((key) => t(key))
  ).map((text) => ({ text, isChat: true }));

  const references = referenceLinks.map((link) => ({
    href: link.href,
    icon: link.icon,
    label: t(link.key),
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

  const handleSuggestionClick = (suggestion: Suggestion) => {
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
      appearance={compact ? "inline" : dock ? "docked" : "panel"}
      activeSources={activeSources}
      onToggleSource={onToggleSource}
      activeSkills={activeSkills}
      onToggleSkill={onToggleSkill}
      showSourceToggle={!dock}
      showModelSelector={!!onSelectModel}
      selectedModel={selectedModel}
      onSelectModel={onSelectModel}
      inputRef={inputRef}
      availableProviders={availableProviders}
      evidenceLabel={evidenceLabel}
      onClearEvidence={onClearEvidence}
      fieldClassName={dock ? "min-h-24 text-[0.9375rem] leading-6" : undefined}
    />
  );

  if (compact) {
    return (
      <div className="flex w-full flex-col gap-4 pt-3">
        {input}
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion.text}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={isBlocked || isLoading}
              variant="chip"
              size="chip"
              className="h-auto min-h-8 whitespace-normal px-3 py-1.5 text-left text-[0.8125rem]"
            >
              {suggestion.text}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (dock) {
    // Compact rows on the page ground so the composer below stays the only glass.
    const rowClass =
      "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[0.875rem] text-foreground/80 transition-colors duration-150 hover:bg-foreground/[0.06] hover:text-foreground focus-visible:bg-foreground/[0.06] focus-visible:text-foreground focus-visible:outline-none active:bg-foreground/[0.1] disabled:cursor-not-allowed disabled:opacity-50";
    const rowContent = (text: string) => (
      <>
        <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1">{text}</span>
        <ArrowUpRight
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          aria-hidden
        />
      </>
    );

    return (
      <div className="flex flex-1 flex-col px-4 pt-6 md:px-8 md:pt-10">
        <ul className="mx-auto w-full max-w-2xl animate-fade-in">
          {suggestions.map((suggestion) => (
            <li key={suggestion.text}>
              <button
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={isBlocked || isLoading}
                className={rowClass}
              >
                {rowContent(suggestion.text)}
              </button>
            </li>
          ))}
        </ul>

        <div className="mx-auto mt-auto w-full max-w-2xl animate-fade-in-up">
          {input}
          {/* Pages worth opening sit beside the composer where there is width; the
              bottom padding clears the floating dock on laptop heights. */}
          <div className="mt-4 hidden flex-wrap items-center gap-1.5 pb-10 md:flex">
            {references.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[0.8125rem] text-muted-foreground transition-colors duration-150 hover:border-foreground/25 hover:text-foreground focus-visible:outline-none"
              >
                <item.icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-10 md:px-8">
      <div className="mx-auto mb-8 w-full max-w-2xl animate-fade-in">
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-[-0.01em] text-foreground md:text-[2rem]">
          {(() => {
            const raw = t("chat.heading");
            const parts = raw.split(/<highlight>|<\/highlight>/);
            if (parts.length === 3) {
              return <>{parts[0]}{parts[1]}{parts[2]}</>;
            }
            return raw;
          })()}
        </h1>
        <p className="mt-3 max-w-xl text-[0.9375rem] leading-relaxed text-muted-foreground">
          {t("chat.description")}
        </p>
      </div>

      <div
        className="mx-auto w-full max-w-2xl animate-fade-in-up"
        style={{ animationDelay: "100ms" }}
      >
        {input}

        <ul className="glass-card mt-6 divide-y divide-border rounded-3xl border border-foreground/10 bg-card-glass px-4">
          {suggestions.map((suggestion) => (
            <li key={suggestion.text}>
              <button
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={isBlocked || isLoading}
                className="group flex w-full items-center gap-3 py-3.5 text-left text-[0.9375rem] text-foreground/85 transition-colors duration-150 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none"
              >
                <MessageCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">{suggestion.text}</span>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            </li>
          ))}
          {references.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="group flex min-w-0 items-center gap-3 py-3.5 text-[0.9375rem] text-foreground/85 transition-colors hover:text-foreground focus-visible:outline-none"
              >
                <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">{item.label}</span>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
