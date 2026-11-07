import { usePreferences } from "../state/Preferences";
import { CardsSkeleton } from "../components/Skeletons";
import { useState } from "react";
import { View } from "react-native";
import { indicators, type Indicator } from "../lib/featureApi";
import { indicatorPeriod, indicatorValue } from "../lib/economicIndicators";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { useAuth } from "../state/Auth";
import { Page, Copy, Glass } from "../components/UI";
import {
  AuthGate,
  Filters,
  ResourceState,
  SourceLink,
} from "../components/Content";
import { Chart } from "../components/Chart";
const FREQUENCY = { daily: "日度", monthly: "月度", quarterly: "季度" };
const COMPARISON = {
  daily: "较前一观测日",
  monthly: "较前月",
  quarterly: "较前季",
};
function methodLabel(i: Indicator) {
  if (i.method === "yoy") return "未季调 · 同比";
  if (i.id === "gdp") return "季调 · 季环比折年率";
  if (i.id === "payrolls") return "季调 · 当月就业人数净增";
  if (i.id === "unemployment") return "季调 · U-3 失业率";
  if (i.method === "spread") return "同日10年收益率减2年收益率";
  return "日度国债固定期限收益率";
}
export default function Macro() {
  return (
    <AuthGate skeleton={<CardsSkeleton lines={[{ size: 16, width: "60%" }, { size: 16, width: "40%" }, { size: 16, width: "20%" }, { size: 30, width: "40%" }, { size: 16, width: "30%" }]} chartHeight={120} />} title="宏观指标">
      <MacroContent />
    </AuthGate>
  );
}
function MacroContent() {
  const { locale } = usePreferences();
  const intl = locale === "en" ? "en-US" : "zh-CN";
  const t = useTheme();
  const user = useAuth().session!.user.id;
  const [years, setYears] = useState("3");
  const r = useResource(`macro:${user}`, (s) => indicators(user, s));
  return (
    <Page
      title="宏观指标"
      subtitle="官方数据 · 观察期不等于发布日期。"
      onRefresh={r.refresh}
      refreshing={r.loading}
    >
      <Filters
        values={[
          ["1", "1 年"],
          ["3", "3 年"],
          ["5", "5 年"],
        ]}
        value={years}
        onChange={setYears}
      />
      <ResourceState skeleton={<CardsSkeleton lines={[{ size: 16, width: "60%" }, { size: 16, width: "40%" }, { size: 16, width: "20%" }, { size: 30, width: "40%" }, { size: 16, width: "30%" }]} chartHeight={120} />}
        resource={r}
        empty={!r.data?.indicators.length}
        message="暂无可用宏观数据"
      />
      {r.data?.status !== "ready" && r.data && (
        <Copy muted>部分数据可能延迟或尚未准备完成，请以数据所属期为准。</Copy>
      )}
      {r.data?.indicators.map((i) => {
        const latest = i.history.at(-1)?.date;
        const cutoff = latest
          ? `${Number(latest.slice(0, 4)) - Number(years)}${latest.slice(4)}`
          : "";
        const history = i.history.filter((p) => p.date >= cutoff);
        return (
          <Glass key={i.id} style={{ padding: 20, gap: 12 }}>
            <Copy bold>
              {locale === "en"
                ? i.name_en || i.name_zh
                : i.name_zh || i.name_en}
            </Copy>
            <Copy muted localize={false}>
              {indicatorPeriod(i, i.period, intl)}
            </Copy>
            <Copy muted>{FREQUENCY[i.frequency]}</Copy>
            <Copy size={30} bold localize={false}>
              {indicatorValue(
                i.value,
                i.unit,
                intl,
                i.id === "payrolls" || i.id === "spread",
              )}
            </Copy>
            {i.change === null ? (
              <Copy muted>暂无上期变动</Copy>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <Copy
                  bold
                  localize={false}
                  color={
                    i.change > 0
                      ? t.accent
                      : i.change < 0
                        ? t.negative
                        : undefined
                  }
                >
                  {indicatorValue(i.change, i.change_unit, intl, true)}
                </Copy>
                <Copy muted>{COMPARISON[i.frequency]}</Copy>
              </View>
            )}
            {history.length > 1 && (
              <Chart
                label="宏观指标历史观测值"
                currency={
                  i.unit === "percent"
                    ? "%"
                    : i.unit === "thousands"
                      ? "千人"
                      : "个百分点"
                }
                data={history.map((p) => ({ date: p.date, close: p.value }))}
              />
            )}
            {history.length <= 1 && <Copy muted>暂无历史走势</Copy>}
            <Copy size={12} muted>
              {methodLabel(i)}
            </Copy>
            {i.status !== "ready" && (
              <Copy size={12} muted>
                {i.value === null
                  ? "数据暂不可用"
                  : "延迟数据 · 请以数据所属期为准"}
              </Copy>
            )}
            <Copy muted>近期数据</Copy>
            {i.history
              .slice(-12)
              .reverse()
              .map((p) => (
                <Copy key={p.date} size={12} localize={false}>
                  {indicatorPeriod(i, p.date, intl)} ·{" "}
                  {indicatorValue(
                    p.value,
                    i.unit,
                    intl,
                    i.id === "payrolls" || i.id === "spread",
                  )}
                </Copy>
              ))}
            <SourceLink url={i.source_url}>{i.source} ↗</SourceLink>
          </Glass>
        );
      })}
      <Copy size={12} muted>
        指标升降不是投资收益。官方数据可修订，走势图采用当前可用版本。最近检查：
        {r.data?.fetched_at
          ? `${new Intl.DateTimeFormat(intl, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(r.data.fetched_at))} UTC`
          : "未提供"}
      </Copy>
    </Page>
  );
}
