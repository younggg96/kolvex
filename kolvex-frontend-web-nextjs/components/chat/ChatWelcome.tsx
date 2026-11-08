"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, Briefcase, Youtube, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ChatInput, MODEL_CONFIGS } from "./ChatInput";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
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

/** Order here is the order shown: questions first, then the two page links. */
const suggestionKeys = [
  { key: "chat.suggestions.askCreators", isChat: true },
  { key: "chat.suggestions.holdingsOverlap", isChat: true },
  { key: "chat.suggestions.whoShifted", isChat: true },
  { key: "chat.suggestions.compareOpinions", isChat: false, href: "/dashboard/youtube-opinions" },
  { key: "chat.suggestions.reviewPortfolio", isChat: false, href: "/dashboard/portfolio" },
];

const suggestionIcons = {
  chat: MessageCircle,
  "/dashboard/youtube-opinions": Youtube,
  "/dashboard/portfolio": Briefcase,
};

type Suggestion = {
  text: string;
  icon: typeof MessageCircle;
  /** Sends the text as a question; otherwise the row navigates to `href`. */
  isChat: boolean;
  href?: string;
};

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
  docked: dockedComposer = false,
}: ChatWelcomeProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const compact = variant === "compact";
  const dock = variant === "dock";
  // The docked composer rises the moment the field takes focus so typing never
  // hides behind the phone keyboard.
  const [isTyping, setIsTyping] = useState(false);
  const raised = dockedComposer && isTyping;

  useEffect(() => {
    if (compact) inputRef.current?.focus();
  }, [compact]);

  const suggestions: Suggestion[] = suggestionOverrides
    ? suggestionOverrides.map((text) => ({ text, isChat: true, icon: MessageCircle }))
    : suggestionKeys.map((s) => ({
        text: t(s.key),
        isChat: s.isChat,
        icon: suggestionIcons[(s.href ?? "chat") as keyof typeof suggestionIcons],
        href: s.href,
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
      onFocus={(event) => {
        setIsFocused(true);
        setIsTyping(event.target === inputRef.current);
      }}
      onBlur={() => {
        setIsFocused(false);
        setIsTyping(false);
      }}
      placeholder={placeholder ?? t("chat.input.placeholder")}
      appearance={compact ? "inline" : dock ? "docked" : "panel"}
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
      fieldClassName={dock ? "text-[1.0625rem] leading-7" : undefined}
    />
  );

  if (compact) {
    return (
      <div
        className={cn(
          "flex w-full flex-col gap-4 pt-3",
          raised && "fixed inset-x-0 bottom-[calc(4.75rem+max(1rem,env(safe-area-inset-bottom)))] z-50 mx-auto max-w-2xl px-5 lg:hidden"
        )}
      >
        {input}
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.text}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              disabled={isBlocked || isLoading}
              className="rounded-full border border-border px-3 py-1.5 text-left text-[0.8125rem] text-muted-foreground transition-colors duration-150 hover:border-foreground/25 hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.1] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none"
            >
              {suggestion.text}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (dock) {
    const rowClass =
      "group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[0.9375rem] transition-colors duration-150 hover:bg-foreground/[0.06] focus-visible:bg-foreground/[0.06] focus-visible:outline-none active:bg-foreground/[0.1] disabled:cursor-not-allowed disabled:opacity-50";

    return (
      <div className="flex flex-1 flex-col justify-end gap-2 px-4 pt-4 pb-[calc(max(1rem,env(safe-area-inset-bottom))+1.25rem)] lg:gap-4 lg:px-8 lg:pb-10">
        <ul
          className={cn(
            "mx-auto w-full max-w-2xl",
            // The rows carry the page-ground treatment only while the composer
            // sits on the tab bar; once raised they scroll away instead.
            !raised && "animate-fade-in",
            raised && "px-1 md:pointer-events-none md:opacity-0"
          )}
          aria-hidden={raised || undefined}
        >
          {suggestions.map((suggestion) => {
            const Icon = suggestion.icon;
            const row = (
              <>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">{suggestion.text}</span>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </>
            );
            return (
              <li key={`${suggestion.href ?? "chat"}:${suggestion.text}`}>
                {suggestion.href ? (
                  <Link href={suggestion.href} className={rowClass}>
                    {row}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    disabled={isBlocked || isLoading}
                    className={rowClass}
                  >
                    {row}
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <div
          className={cn(
            "mx-auto w-full max-w-2xl animate-fade-in-up",
            // Raised: the composer settles on the tab bar while the keyboard is
            // open, so the rows above it scroll under the field instead of
            // squeezing it. The field goes bare there; the dock's glass carries it.
            raised
              ? "glass-card fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[35] !w-auto !max-w-none !mx-0 !my-0 overflow-hidden rounded-t-[1.75rem] border-b-0 bg-card-glass-strong lg:inset-x-8 lg:bottom-10 lg:rounded-[1.625rem]"
              : undefined
          )}
          style={{ animationDelay: "100ms" }}
          data-docked-composer={dockedComposer || undefined}
        >
          {input}
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
          {suggestions.map((suggestion) => {
            const Icon = suggestion.icon;
            const row = (
              <>
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1">{suggestion.text}</span>
                <ArrowUpRight
                  className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </>
            );
            return (
              <li key={`${suggestion.href ?? "chat"}:${suggestion.text}`}>
                {suggestion.href ? (
                  <Link
                    href={suggestion.href}
                    className="group flex min-w-0 items-center gap-3 py-3.5 text-[0.9375rem] transition-colors hover:text-foreground focus-visible:outline-none"
                  >
                    {row}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    disabled={isBlocked || isLoading}
                    className="group flex w-full items-center gap-3 py-3.5 text-left text-[0.9375rem] transition-colors duration-150 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none"
                  >
                    {row}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
