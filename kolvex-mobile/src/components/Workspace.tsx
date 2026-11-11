// Shared pieces of the Web's components/chat/workspace/parts.tsx.
import { View } from "react-native";
import type {
  AgentStatus,
  ResearchAgent,
  Stance,
} from "../lib/researchWorkspaceApi";
import { SKILL_ICONS } from "../lib/chatSkills";
import { useTheme } from "../lib/theme";
import { Copy } from "./UI";

export const AGENT_NAMES: Record<ResearchAgent, string> = {
  market: "行情与技术",
  fundamentals: "基本面",
  news: "新闻与事件",
  creators: "博主观点",
  portfolio: "我的持仓",
};
/** The Web's per-agent glyph (parts.tsx AGENT_META); [ios, android] symbol names. */
export const AGENT_ICONS: Record<ResearchAgent, [string, string]> = {
  market: SKILL_ICONS.market,
  fundamentals: SKILL_ICONS.fundamentals,
  news: SKILL_ICONS.news,
  creators: SKILL_ICONS.creators,
  portfolio: SKILL_ICONS.portfolio,
};
export const TOOL_NAMES: Record<string, string> = {
  get_options_chain_summary: "期权链",
  get_creator_opinions: "博主观点库",
  web_search: "网页搜索",
  get_user_portfolio: "投资组合",
};
const ERRORS: Record<string, string> = {
  run_in_progress: "已有一轮研究正在进行。",
  nothing_to_research: "请先添加股票或研究问题。",
  invalid_ticker: "有股票代码格式不对。",
  too_many_tickers: "最多 10 只股票。",
  workspace_unavailable: "工作区暂时不可用。",
  workspace_not_found: "这个工作区已不存在。",
};
export const workspaceErrorText = (code: string | undefined) =>
  (code && ERRORS[code]) || "出了点问题，请重试。";

/** Direction as a written word in the semantic colour; never colour alone. */
export function StanceText({
  stance,
  size = 14,
}: {
  stance: Stance | null | undefined;
  size?: number;
}) {
  const t = useTheme();
  if (!stance) return null;
  const config = {
    bullish: ["偏多", t.accent],
    bearish: ["偏空", t.negative],
    neutral: ["中性", t.secondary],
    mixed: ["分歧", "#C98A00"],
  }[stance];
  return (
    <Copy size={size} bold color={config[1]}>
      {config[0]}
    </Copy>
  );
}
export function AgentStatusText({ status }: { status: AgentStatus }) {
  const t = useTheme();
  return (
    <Copy size={12} color={status === "failed" ? t.negative : t.secondary}>
      {status === "running"
        ? "研究中"
        : status === "failed"
          ? "失败"
          : status === "completed"
            ? "完成"
            : "排队"}
    </Copy>
  );
}
/** One segment per researcher; a segment fills as that researcher finishes. */
export function RelayBar({ statuses }: { statuses: AgentStatus[] }) {
  const t = useTheme();
  const done = statuses.filter(
    (s) => s === "completed" || s === "failed",
  ).length;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: statuses.length, now: done }}
      style={{ flexDirection: "row", gap: 4 }}
    >
      {statuses.map((status, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            overflow: "hidden",
            backgroundColor: t.wash,
          }}
        >
          <View
            style={{
              height: 4,
              width:
                status === "completed" || status === "failed"
                  ? "100%"
                  : status === "running"
                    ? "35%"
                    : "0%",
              backgroundColor: status === "failed" ? t.negative : t.secondary,
            }}
          />
        </View>
      ))}
    </View>
  );
}
export function formatRunTime(iso: string | null | undefined, locale: string) {
  if (!iso) return "";
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
