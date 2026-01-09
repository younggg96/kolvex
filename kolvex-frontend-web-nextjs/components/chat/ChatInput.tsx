"use client";

import { useEffect, useRef } from "react";
import { Send, Users, Newspaper, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SourceToggle } from "@/components/common/SourceToggle";
import type { ChatInputProps, SearchSource } from "./types";

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
    tooltip: string;
  }[] = [
    {
      source: "kol",
      icon: <Users className="w-4 h-4" />,
      label: "KOL",
      tooltip: "Search KOL insights and opinions",
    },
    {
      source: "news",
      icon: <Newspaper className="w-4 h-4" />,
      label: "News",
      tooltip: "Search latest market news",
    },
    {
      source: "web",
      icon: <Globe className="w-4 h-4" />,
      label: "Web",
      tooltip: "Search the web for more info",
    },
  ];

  return (
    <form onSubmit={onSubmit}>
      <div
        className={cn(
          "relative group transition-all duration-300",
          isFocused && "transform scale-[1.005]"
        )}
      >
        {/* Animated Glow Effect */}
        <div
          className={cn(
            "absolute -inset-0.5 rounded-2xl blur-md opacity-0 transition-opacity duration-500",
            "bg-gradient-to-r from-primary/30 via-emerald-500/40 to-primary/30",
            isFocused && "opacity-60 animate-gradient-x"
          )}
        />

        {/* Input Container */}
        <div
          className={cn(
            "relative flex flex-col bg-white dark:bg-card-dark/95 backdrop-blur-xl rounded-2xl border overflow-hidden transition-all duration-300 shadow-sm",
            isFocused
              ? "border-primary/40 shadow-xl shadow-primary/10"
              : "border-gray-200 dark:border-white/10"
          )}
        >
          <div className="flex items-start gap-3 p-4">
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={onFocus}
              onBlur={onBlur}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              disabled={isLoading}
              className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/40 text-base resize-none outline-none min-h-[28px] max-h-[120px] leading-7 disabled:opacity-50"
              rows={1}
            />
          </div>

          {showSourceToggle && onToggleSource ? (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-1">
                {sourceConfig.map(({ source, icon, label, tooltip }) => (
                  <SourceToggle
                    key={source}
                    icon={icon}
                    label={label}
                    tooltip={tooltip}
                    active={activeSources.includes(source)}
                    onClick={() => onToggleSource(source)}
                  />
                ))}
              </div>
              <Button
                type="submit"
                disabled={!value.trim() || isLoading}
                variant="icon"
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end px-4 py-3 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
              <Button
                type="submit"
                disabled={!value.trim() || isLoading}
                variant="icon"
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}

// Compact version for chat mode
export function ChatInputCompact({
  value,
  onChange,
  onSubmit,
  onKeyDown,
  isLoading = false,
  isFocused = false,
  onFocus,
  onBlur,
  placeholder = "Continue the conversation...",
  inputRef: externalRef,
}: Omit<
  ChatInputProps,
  "activeSources" | "onToggleSource" | "showSourceToggle"
>) {
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

  return (
    <form onSubmit={onSubmit}>
      <div
        className={cn(
          "relative group transition-all duration-300",
          isFocused && "transform scale-[1.005]"
        )}
      >
        {/* Subtle Glow Effect */}
        <div
          className={cn(
            "absolute -inset-0.5 bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20 rounded-2xl blur-sm opacity-0 transition-opacity duration-500",
            isFocused && "opacity-50"
          )}
        />

        {/* Input Container */}
        <div
          className={cn(
            "relative flex items-end gap-3 bg-white dark:bg-card-dark/95 backdrop-blur-xl rounded-2xl border overflow-hidden transition-all duration-300 shadow-sm px-4 py-3",
            isFocused
              ? "border-primary/40 shadow-lg shadow-primary/5"
              : "border-gray-200 dark:border-white/10"
          )}
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
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/40 text-base resize-none outline-none min-h-[28px] max-h-[120px] leading-7 disabled:opacity-50"
            rows={1}
          />
          <Button
            type="submit"
            disabled={!value.trim() || isLoading}
            variant="icon"
            size="icon"
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
