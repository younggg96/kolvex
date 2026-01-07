"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  SourceToggle,
  type SearchSource,
} from "@/components/common/SourceToggle";
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Users,
  Newspaper,
  Globe,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  { text: "Top trending stocks", href: "/dashboard/stocks" },
  { text: "Market sentiment", href: "/dashboard/analytics" },
  { text: "KOL insights on TSLA", href: "/dashboard/stock/TSLA" },
  { text: "Latest news", href: "/dashboard/news" },
];

export default function Dashboard() {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [activeSource, setActiveSource] = useState<SearchSource>("kol");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // For now, navigate to stocks page with search
      router.push(`/dashboard/stocks?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <DashboardLayout
      title="Chat with Kolvex"
      showHeader={true}
      headerClassName="lg:hidden"
    >
      <div className="relative flex-1 flex flex-col min-h-0 bg-background-light dark:bg-background-dark">
        <div className="absolute inset-0 bg-grid opacity-80 pointer-events-none" />

        <div className="relative flex-1 flex flex-col items-center justify-center p-4 md:p-6 overflow-auto">
          {/* Welcome Section */}
          <div className="w-full max-w-3xl mx-auto text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold mb-4">
              <Sparkles className="w-3 h-3" />
              AI-POWERED INSIGHTS
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
              What would you like to explore?
            </h1>
            <p className="text-gray-600 dark:text-white/60 text-base">
              Ask about stocks, market trends, or browse our curated insights
            </p>
          </div>

          {/* Search Input */}
          <div
            className="w-full max-w-2xl mx-auto mb-8 animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            <form onSubmit={handleSubmit}>
              <div
                className={cn(
                  "relative group transition-all duration-300",
                  isFocused && "transform scale-[1.01]"
                )}
              >
                {/* Glow Effect */}
                <div
                  className={cn(
                    "absolute -inset-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40 rounded-2xl blur-sm opacity-0 transition-opacity duration-500",
                    isFocused && "opacity-50"
                  )}
                />

                {/* Input Container */}
                <div
                  className={cn(
                    "relative flex flex-col bg-white dark:bg-card-dark/95 backdrop-blur-xl rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden transition-all duration-300 shadow-sm",
                    isFocused && "border-primary/40 shadow-lg shadow-primary/5"
                  )}
                >
                  <div className="flex items-start gap-3 p-4">
                    <textarea
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask anything about stocks, markets, or investments..."
                      className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/40 text-base resize-none outline-none min-h-[28px] max-h-[120px] leading-7"
                      rows={1}
                    />
                  </div>

                  <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-1">
                      <SourceToggle
                        icon={<Users className="w-4 h-4" />}
                        label="KOL"
                        active={activeSource === "kol"}
                        onClick={() => setActiveSource("kol")}
                      />
                      <SourceToggle
                        icon={<Newspaper className="w-4 h-4" />}
                        label="News"
                        active={activeSource === "news"}
                        onClick={() => setActiveSource("news")}
                      />
                      <SourceToggle
                        icon={<Globe className="w-4 h-4" />}
                        label="Web"
                        active={activeSource === "web"}
                        onClick={() => setActiveSource("web")}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!query.trim()}
                      className={cn(
                        "flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200",
                        query.trim()
                          ? "bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/25"
                          : "bg-gray-200 dark:bg-white/10 text-gray-400 dark:text-white/40 cursor-not-allowed"
                      )}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* Quick Suggestions */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => router.push(suggestion.href)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 hover:border-primary/30 text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white text-xs font-medium transition-all duration-200"
                >
                  <Zap className="w-3 h-3 text-primary/70" />
                  {suggestion.text}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div
            className="w-full max-w-3xl mx-auto animate-fade-in-up"
            style={{ animationDelay: "200ms" }}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {quickActions.map((action, index) => (
                <button
                  key={index}
                  onClick={() => router.push(action.href)}
                  className="group flex items-center gap-3 px-4 py-3 rounded-xl bg-white/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 hover:border-primary/30 hover:bg-white dark:hover:bg-white/10 transition-all duration-200"
                >
                  <span className="text-gray-400 dark:text-white/40 group-hover:text-primary transition-colors">
                    {action.icon}
                  </span>
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                      {action.title}
                    </h3>
                    <p className="text-gray-400 dark:text-white/40 text-xs">
                      {action.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
