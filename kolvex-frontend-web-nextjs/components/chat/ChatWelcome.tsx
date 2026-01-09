"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  TrendingUp,
  BarChart3,
  Users,
  Newspaper,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChipButton } from "@/components/ui/chip-button";
import { ChatInput } from "./ChatInput";
import type { ChatWelcomeProps, SearchSource } from "./types";
import { Button } from "../ui/button";

interface QuickAction {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}

const quickActions: QuickAction[] = [
  {
    icon: <BarChart3 className="w-4 h-4" />,
    title: "Analytics",
    description: "Sentiment & trends",
    href: "/dashboard/analytics",
  },
  {
    icon: <TrendingUp className="w-4 h-4" />,
    title: "Stocks",
    description: "Trending stocks",
    href: "/dashboard/stocks",
  },
  {
    icon: <Users className="w-4 h-4" />,
    title: "KOLs",
    description: "Social influencers",
    href: "/dashboard/social/twitter",
  },
  {
    icon: <Newspaper className="w-4 h-4" />,
    title: "News",
    description: "Market news",
    href: "/dashboard/news",
  },
];

const suggestions = [
  { text: "Analyze NVIDIA stock", isChat: true },
  { text: "Explain market trends", isChat: true },
  { text: "Top trending stocks", href: "/dashboard/stocks", isChat: false },
  { text: "Latest news", href: "/dashboard/news", isChat: false },
];

export function ChatWelcome({
  onSubmit,
  isLoading = false,
  activeSources,
  onToggleSource,
}: ChatWelcomeProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) {
      onSubmit(query.trim());
      setQuery("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSuggestionClick = (suggestion: (typeof suggestions)[0]) => {
    if (suggestion.isChat) {
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
          AI-Powered Insights
        </div>

        {/* Heading */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">
          What would you like to <span className="text-primary">explore</span>?
        </h1>

        {/* Description */}
        <p className="text-gray-600 dark:text-white/60 text-sm max-w-xl mx-auto">
          Ask about stocks, market trends, or browse our curated insights
          powered by AI
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
          onKeyDown={handleKeyDown}
          isLoading={isLoading}
          isFocused={isFocused}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          activeSources={activeSources}
          onToggleSource={onToggleSource}
          inputRef={inputRef}
        />

        {/* Quick Suggestions */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {suggestions.map((suggestion, index) => (
            <ChipButton
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
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
