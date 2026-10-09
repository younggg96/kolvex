import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import {
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

const AGENT_ICONS: Record<string, LucideIcon> = {
  "Market Analyst": BarChart3,
  "Social Analyst": Users,
  "News Analyst": Newspaper,
  "Fundamentals Analyst": DollarSign,
  "Bull Researcher": TrendingUp,
  "Bear Researcher": TrendingDown,
  "Research Manager": Scale,
  Trader: Briefcase,
  "Aggressive Analyst": Zap,
  "Conservative Analyst": Shield,
  "Neutral Analyst": Scale,
  "Risk Judge": ShieldCheck,
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

function AgentStep({
  group,
}: {
  group: AgentGroup;
}) {
  const Icon = AGENT_ICONS[group.agentName] || Bot;
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
      <div className="space-y-1.5">
        {group.events.map((ev, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 text-xs leading-5 text-muted-foreground"
          >
            <CheckCircle2 aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="min-w-0 break-words">{ev.message || ev.stage}</span>
            {ev.elapsed != null && (
              <span className="ml-auto text-[11px] text-muted-foreground tabular-nums shrink-0">
                {ev.elapsed}s
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="border-t border-border py-2 first:border-t-0 first:pt-0">
      <button
        type="button"
        onClick={toggleExpanded}
        disabled={!hasDetail}
        aria-expanded={hasDetail ? expanded : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-sm py-1.5 text-left outline-offset-4",
          hasDetail && "cursor-pointer hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
        )}
      >
        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className={cn("min-w-0 truncate text-xs font-medium", group.isActive ? "text-foreground" : "text-muted-foreground")}>
          {group.agentName}
        </span>
        {group.elapsed != null && (
          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">
            {group.elapsed}s
          </span>
        )}
        {hasDetail && (
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
              expanded && "rotate-180",
            )}
          />
        )}
      </button>

      {expanded && hasDetail && (
        <div className="space-y-3 pb-1 pl-6 pt-1">
          {group.toolCalls.length > 0 && (
            <div className="space-y-1.5">
              {group.toolCalls.map((tc, i) => (
                <div key={i} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  {tc.startsWith("→") ? (
                    <FileText aria-hidden="true" className="mt-1 h-3 w-3 shrink-0" />
                  ) : (
                    <Wrench aria-hidden="true" className="mt-1 h-3 w-3 shrink-0" />
                  )}
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">{tc}</span>
                </div>
              ))}
            </div>
          )}

          {group.latestDetail && (
            <div className="text-xs leading-6 text-muted-foreground">
              <p className="mb-1 text-[11px] font-medium">
                {group.latestDetailType === "report_preview" ? "Report" : "Thinking"}
              </p>
              <div className="line-clamp-4 break-words [overflow-wrap:anywhere]">
                {group.latestDetail}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ProgressLog({
  events,
  isLive = true,
}: {
  events: ProgressEvent[];
  isLive?: boolean;
}) {
  const groups = useMemo(() => groupByAgent(events), [events]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    });
  }, [groups.length, events.length]);

  return (
    <div className="py-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Agent activity</span>
        <div className="ml-auto flex items-center gap-1.5" aria-live="polite">
          <span
            className={cn(
              "h-1 w-1 rounded-full",
              isLive ? "bg-positive-fill" : "bg-warning"
            )}
          />
          <span className="text-[11px] text-muted-foreground">
            {isLive ? "Live" : "Syncing"}
          </span>
        </div>
      </div>

      {/* Activity feed */}
      <div
        ref={scrollRef}
        className="max-h-64 space-y-3 overflow-y-auto pr-2 [scrollbar-gutter:stable]"
      >
        {groups.map((group, i) => (
          <AgentStep
            key={`${group.agentName}-${i}`}
            group={group}
          />
        ))}
      </div>
    </div>
  );
}
