import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {
  Loader2,
  CheckCircle2,
  BarChart3,
  Users,
  Newspaper,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Bot,
  Briefcase,
  ShieldCheck,
  Zap,
  Shield,
  Scale,
  Wrench,
  Brain,
  FileText,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgressEvent } from "@/lib/tradingAnalysisApi";

const NODE_AGENT_MAP: Record<string, string> = {
  "Market Analyst": "Market Analyst",
  tools_market: "Market Analyst",
  "Msg Clear Market": "Market Analyst",
  "Social Analyst": "Social Analyst",
  tools_social: "Social Analyst",
  "Msg Clear Social": "Social Analyst",
  "News Analyst": "News Analyst",
  tools_news: "News Analyst",
  "Msg Clear News": "News Analyst",
  "Fundamentals Analyst": "Fundamentals Analyst",
  tools_fundamentals: "Fundamentals Analyst",
  "Msg Clear Fundamentals": "Fundamentals Analyst",
  "Bull Researcher": "Bull Researcher",
  "Bear Researcher": "Bear Researcher",
  "Research Manager": "Research Manager",
  Trader: "Trader",
  "Aggressive Analyst": "Aggressive Analyst",
  "Conservative Analyst": "Conservative Analyst",
  "Neutral Analyst": "Neutral Analyst",
  "Risk Judge": "Risk Judge",
};

interface AgentTheme {
  icon: LucideIcon;
  accent: string;
  bg: string;
  border: string;
  text: string;
}

const AGENT_THEMES: Record<string, AgentTheme> = {
  "Market Analyst": {
    icon: BarChart3,
    accent: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    text: "text-blue-300",
  },
  "Social Analyst": {
    icon: Users,
    accent: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    text: "text-purple-300",
  },
  "News Analyst": {
    icon: Newspaper,
    accent: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-300",
  },
  "Fundamentals Analyst": {
    icon: DollarSign,
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-300",
  },
  "Bull Researcher": {
    icon: TrendingUp,
    accent: "text-green-400",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    text: "text-green-300",
  },
  "Bear Researcher": {
    icon: TrendingDown,
    accent: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    text: "text-red-300",
  },
  "Research Manager": {
    icon: Scale,
    accent: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    text: "text-yellow-300",
  },
  Trader: {
    icon: Briefcase,
    accent: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    text: "text-cyan-300",
  },
  "Aggressive Analyst": {
    icon: Zap,
    accent: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    text: "text-orange-300",
  },
  "Conservative Analyst": {
    icon: Shield,
    accent: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    text: "text-sky-300",
  },
  "Neutral Analyst": {
    icon: Scale,
    accent: "text-gray-400",
    bg: "bg-gray-500/10",
    border: "border-gray-500/20",
    text: "text-gray-300",
  },
  "Risk Judge": {
    icon: ShieldCheck,
    accent: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    text: "text-yellow-300",
  },
};

const DEFAULT_THEME: AgentTheme = {
  icon: Bot,
  accent: "text-primary",
  bg: "bg-primary/10",
  border: "border-primary/20",
  text: "text-primary/80",
};

interface AgentGroup {
  agentName: string;
  events: ProgressEvent[];
  toolCalls: string[];
  latestDetail?: string;
  latestDetailType?: string;
  elapsed?: number;
  isActive: boolean;
}

function getAgentName(node?: string): string {
  if (!node) return "System";
  return NODE_AGENT_MAP[node] || node;
}

function groupByAgent(events: ProgressEvent[]): AgentGroup[] {
  const groups: AgentGroup[] = [];
  let currentAgent: string | null = null;
  let currentGroup: AgentGroup | null = null;

  for (const ev of events) {
    const agent = getAgentName(ev.node);

    if (agent !== currentAgent) {
      if (currentGroup) groups.push(currentGroup);
      currentAgent = agent;
      currentGroup = {
        agentName: agent,
        events: [],
        toolCalls: [],
        isActive: false,
      };
    }

    currentGroup!.events.push(ev);
    currentGroup!.elapsed = ev.elapsed;

    if (ev.detail_type === "tool_call" && ev.detail) {
      currentGroup!.toolCalls.push(ev.detail);
    } else if (ev.detail_type === "tool_result" && ev.detail) {
      currentGroup!.toolCalls.push(`→ ${ev.detail}`);
    }

    if (
      ev.detail &&
      (ev.detail_type === "thinking" || ev.detail_type === "report_preview")
    ) {
      currentGroup!.latestDetail = ev.detail;
      currentGroup!.latestDetailType = ev.detail_type;
    }
  }

  if (currentGroup) groups.push(currentGroup);

  if (groups.length > 0) {
    groups[groups.length - 1].isActive = true;
  }

  return groups;
}

function TypewriterText({
  text,
  active,
  speed = 8,
}: {
  text: string;
  active: boolean;
  speed?: number;
}) {
  const [charIdx, setCharIdx] = useState(0);
  const prevTextRef = useRef("");

  useEffect(() => {
    if (!active || !text) {
      setCharIdx(text?.length || 0);
      return;
    }

    const startFrom = text.startsWith(prevTextRef.current)
      ? prevTextRef.current.length
      : 0;

    setCharIdx(startFrom);

    let i = startFrom;
    const timer = setInterval(() => {
      i += 1;
      if (i >= text.length) {
        setCharIdx(text.length);
        clearInterval(timer);
        prevTextRef.current = text;
      } else {
        setCharIdx(i);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, active, speed]);

  if (!text) return null;

  return (
    <span>
      {text.slice(0, charIdx)}
      {active && charIdx < text.length && (
        <span className="inline-block w-[2px] h-[1em] bg-current align-text-bottom animate-blink-cursor ml-px" />
      )}
    </span>
  );
}

function AgentStep({
  group,
  isLast,
}: {
  group: AgentGroup;
  isLast: boolean;
}) {
  const theme = AGENT_THEMES[group.agentName] || DEFAULT_THEME;
  const Icon = theme.icon;
  const isSystem = group.agentName === "System";
  const [expanded, setExpanded] = useState(true);

  const hasDetail = !!(
    group.latestDetail ||
    group.toolCalls.length > 0
  );

  const toggleExpanded = useCallback(() => {
    if (hasDetail) setExpanded((p) => !p);
  }, [hasDetail]);

  if (isSystem) {
    return (
      <div className="space-y-0.5">
        {group.events.map((ev, i) => (
          <div
            key={i}
            className="flex items-center gap-2 text-[11px] text-gray-400 animate-slide-in"
          >
            <CheckCircle2 className="w-3 h-3 text-primary shrink-0" />
            <span className="truncate">{ev.message || ev.stage}</span>
            {ev.elapsed != null && (
              <span className="ml-auto text-[10px] text-gray-600 tabular-nums shrink-0">
                {ev.elapsed}s
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border transition-all duration-500 animate-slide-in overflow-hidden",
        group.isActive
          ? `${theme.border} ${theme.bg}`
          : "border-gray-800/50 bg-gray-900/30"
      )}
    >
      {/* Agent header */}
      <button
        type="button"
        onClick={toggleExpanded}
        className={cn(
          "flex items-center gap-2 w-full px-2.5 py-1.5 text-left",
          hasDetail && "cursor-pointer hover:bg-white/[0.02]"
        )}
      >
        <div
          className={cn(
            "w-5 h-5 rounded flex items-center justify-center shrink-0",
            group.isActive ? theme.bg : "bg-gray-800/60"
          )}
        >
          {group.isActive ? (
            <Loader2
              className={cn("w-3 h-3 animate-spin", theme.accent)}
            />
          ) : (
            <Icon
              className={cn(
                "w-3 h-3",
                group.isActive ? theme.accent : "text-gray-500"
              )}
            />
          )}
        </div>
        <span
          className={cn(
            "text-[11px] font-semibold truncate",
            group.isActive ? theme.accent : "text-gray-400"
          )}
        >
          {group.agentName}
        </span>
        {group.isActive && (
          <span className="flex items-center gap-1 ml-1">
            <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
            <span
              className="w-1 h-1 rounded-full bg-current animate-pulse"
              style={{ animationDelay: "200ms" }}
            />
            <span
              className="w-1 h-1 rounded-full bg-current animate-pulse"
              style={{ animationDelay: "400ms" }}
            />
          </span>
        )}
        {group.elapsed != null && (
          <span className="ml-auto text-[10px] text-gray-600 tabular-nums shrink-0">
            {group.elapsed}s
          </span>
        )}
        {hasDetail && (
          <ChevronDown
            className={cn(
              "w-3 h-3 text-gray-600 shrink-0 transition-transform duration-200",
              expanded && "rotate-180"
            )}
          />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div className="px-2.5 pb-2 space-y-1.5 animate-fade-in">
          {/* Tool calls */}
          {group.toolCalls.length > 0 && (
            <div className="space-y-0.5 ml-1">
              {group.toolCalls.map((tc, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 text-[10px] text-gray-500 font-mono animate-slide-in"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  {tc.startsWith("→") ? (
                    <FileText className="w-3 h-3 shrink-0 mt-px text-gray-600" />
                  ) : (
                    <Wrench className="w-3 h-3 shrink-0 mt-px text-gray-600" />
                  )}
                  <span className="break-all">{tc}</span>
                </div>
              ))}
            </div>
          )}

          {/* Thinking / Report detail */}
          {group.latestDetail && (
            <div
              className={cn(
                "rounded px-2 py-1.5 text-[10px] leading-relaxed border-l-2",
                group.isActive
                  ? `bg-black/20 ${theme.border} ${theme.text}`
                  : "bg-black/10 border-gray-700 text-gray-500"
              )}
            >
              <div className="flex items-center gap-1 mb-0.5">
                <Brain className="w-2.5 h-2.5 opacity-60" />
                <span className="text-[9px] font-medium uppercase tracking-wider opacity-60">
                  {group.latestDetailType === "report_preview"
                    ? "Report"
                    : "Thinking"}
                </span>
              </div>
              <div className="line-clamp-4">
                {group.isActive ? (
                  <TypewriterText
                    text={group.latestDetail}
                    active={group.isActive}
                  />
                ) : (
                  group.latestDetail
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProgressLog({ events }: { events: ProgressEvent[] }) {
  const groups = useMemo(() => groupByAgent(events), [events]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, [groups.length, events.length]);

  return (
    <div className="rounded-lg bg-gray-950 dark:bg-black/60 border border-gray-800 dark:border-white/5 overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-800 dark:border-white/5 bg-gray-900 dark:bg-white/[0.02]">
        <span className="w-2 h-2 rounded-full bg-red-500/60" />
        <span className="w-2 h-2 rounded-full bg-yellow-500/60" />
        <span className="w-2 h-2 rounded-full bg-green-500/60" />
        <span className="ml-2 text-[10px] text-gray-500 font-mono tracking-wider">
          agent activity
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[9px] text-gray-600 font-mono">live</span>
        </div>
      </div>

      {/* Activity feed */}
      <div
        ref={scrollRef}
        className="p-2.5 space-y-1.5 max-h-80 overflow-y-auto"
      >
        {groups.map((group, i) => (
          <AgentStep
            key={`${group.agentName}-${i}`}
            group={group}
            isLast={i === groups.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
