// The Web's AnalysisProgress + ProgressLog for a running research task, fed by the
// task record's progress_events (refreshed by the screen's polling).
import { useState } from "react";
import { Pressable, View } from "react-native";
import type { AnalysisProgressEvent } from "../lib/contentTypes";
import { useTheme } from "../lib/theme";
import { Copy, Glass, styles } from "./UI";

const STAGES: [string, string, string][] = [
  ["initializing", "初始化", "正在搭建分析环境"],
  ["analysts", "分析师", "运行市场、新闻与情绪分析"],
  ["debate", "辩论", "多空研究员辩论进行中"],
  ["trader", "交易员", "生成交易建议"],
  ["risk", "风控", "风险评估与最终审核"],
  ["translating", "翻译", "正在把报告翻译成中文"],
  ["completed", "完成", "分析已完成"],
];
const NODE_AGENT: Record<string, string> = {
  tools_market: "Market Analyst",
  "Msg Clear Market": "Market Analyst",
  tools_social: "Social Analyst",
  "Msg Clear Social": "Social Analyst",
  tools_news: "News Analyst",
  "Msg Clear News": "News Analyst",
  tools_fundamentals: "Fundamentals Analyst",
  "Msg Clear Fundamentals": "Fundamentals Analyst",
};
type Group = {
  agent: string;
  events: AnalysisProgressEvent[];
  tools: string[];
  detail?: string;
  detailType?: string;
  elapsed?: number;
};
function groupByAgent(events: AnalysisProgressEvent[]) {
  const groups: Group[] = [];
  for (const event of events) {
    const agent = event.node
      ? (NODE_AGENT[event.node] ?? event.node)
      : "System";
    let group = groups[groups.length - 1];
    if (!group || group.agent !== agent) {
      group = { agent, events: [], tools: [] };
      groups.push(group);
    }
    group.events.push(event);
    group.elapsed = event.elapsed;
    if (event.detail_type === "tool_call" && event.detail)
      group.tools.push(event.detail);
    else if (event.detail_type === "tool_result" && event.detail)
      group.tools.push(`→ ${event.detail}`);
    if (
      event.detail &&
      (event.detail_type === "thinking" ||
        event.detail_type === "report_preview")
    ) {
      group.detail = event.detail;
      group.detailType = event.detail_type;
    }
  }
  return groups;
}

export function ResearchProgress({
  events,
  stage,
}: {
  events: AnalysisProgressEvent[];
  stage?: string | null;
}) {
  const t = useTheme();
  const current = stage ?? events[events.length - 1]?.stage;
  const active = Math.max(
    STAGES.findIndex(([key]) => key === current),
    0,
  );
  const elapsed = events[events.length - 1]?.elapsed;
  const groups = groupByAgent(events);
  return (
    <Glass style={{ padding: 16, gap: 12 }}>
      <View style={styles.row}>
        <Copy size={14} bold>
          分析进行中
        </Copy>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {elapsed != null && (
            <Copy size={12} muted>{`已运行 ${Math.round(elapsed)} 秒`}</Copy>
          )}
          <Copy size={12} muted localize={false}>
            {`${active + 1}/${STAGES.length}`}
          </Copy>
        </View>
      </View>
      <View style={{ height: 2, backgroundColor: t.border }}>
        <View
          style={{
            height: 2,
            width: `${Math.max(Math.round((active / (STAGES.length - 1)) * 100), 5)}%`,
            backgroundColor: t.brand,
          }}
        />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 8 }}>
        {STAGES.map(([key, label], index) => (
          <View
            key={key}
            accessibilityState={{ selected: index === active }}
            style={{
              width: "33.33%",
              flexDirection: "row",
              gap: 6,
              paddingBottom: 6,
              borderBottomWidth: 1,
              borderColor: index === active ? t.text : t.border,
            }}
          >
            <Copy
              size={12}
              localize={false}
              color={index < active ? t.accent : t.secondary}
            >
              {index < active ? "✓" : String(index + 1)}
            </Copy>
            <Copy size={12} bold={index === active} muted={index !== active}>
              {label}
            </Copy>
          </View>
        ))}
      </View>
      <View style={{ gap: 2 }}>
        <Copy size={14} bold>
          {STAGES[active][1]}
        </Copy>
        <Copy size={12} muted>
          {STAGES[active][2]}
        </Copy>
      </View>
      {groups.length > 0 && (
        <View style={{ gap: 8 }}>
          {groups.map((group, index) => (
            <AgentStep
              key={`${group.agent}-${index}`}
              group={group}
              active={index === groups.length - 1}
            />
          ))}
        </View>
      )}
    </Glass>
  );
}

function AgentStep({ group, active }: { group: Group; active: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(true);
  const hasDetail = !!group.detail || group.tools.length > 0;
  if (group.agent === "System")
    return (
      <View style={{ gap: 4 }}>
        {group.events.map((event, i) => (
          <View key={i} style={[styles.row, { alignItems: "flex-start" }]}>
            <View style={{ flex: 1 }}>
              <Copy size={12} muted localize={false}>
                {`✓ ${event.message || event.stage}`}
              </Copy>
            </View>
            {event.elapsed != null && (
              <Copy size={12} muted localize={false}>
                {`${event.elapsed}s`}
              </Copy>
            )}
          </View>
        ))}
      </View>
    );
  return (
    <View style={{ borderTopWidth: 1, borderColor: t.border, paddingTop: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: !hasDetail }}
        disabled={!hasDetail}
        onPress={() => setOpen((v) => !v)}
        style={[styles.row, { minHeight: 36 }]}
      >
        <View style={{ flex: 1 }}>
          <Copy size={12} bold muted={!active} localize={false}>
            {group.agent}
          </Copy>
        </View>
        {group.elapsed != null && (
          <Copy size={12} muted localize={false}>
            {`${group.elapsed}s`}
          </Copy>
        )}
        {hasDetail && (
          <Copy size={12} muted localize={false}>
            {open ? "⌃" : "⌄"}
          </Copy>
        )}
      </Pressable>
      {open && hasDetail && (
        <View style={{ gap: 6, paddingLeft: 12, paddingBottom: 4 }}>
          {group.tools.map((tool, i) => (
            <Copy key={i} size={12} muted localize={false}>
              {tool.startsWith("→") ? tool : `⚙ ${tool}`}
            </Copy>
          ))}
          {!!group.detail && (
            <Copy size={12} muted lines={4} localize={false}>
              {`${group.detailType === "report_preview" ? "Report" : "Thinking"} · ${group.detail}`}
            </Copy>
          )}
        </View>
      )}
    </View>
  );
}
