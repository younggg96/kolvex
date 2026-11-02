import { usePreferences } from "../state/Preferences";
import { useState } from "react";
import { indicators, indicatorValue } from "../lib/featureApi";
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
export default function Macro() {
  return (
    <AuthGate title="宏观指标">
      <MacroContent />
    </AuthGate>
  );
}
function MacroContent() {
  const { locale } = usePreferences();
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
      <ResourceState
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
            <Copy size={30} bold>
              {indicatorValue(i.value, i.unit)}
            </Copy>
            <Copy muted>
              {i.period || "所属期未提供"} · {i.frequency} · {i.status}
            </Copy>
            <Copy>前期变动 {indicatorValue(i.change, i.change_unit)}</Copy>
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
            <Copy muted>近期数据</Copy>
            {i.history
              .slice(-12)
              .reverse()
              .map((p) => (
                <Copy key={p.date} size={12}>
                  {p.date} · {indicatorValue(p.value, i.unit)}
                </Copy>
              ))}
            <SourceLink url={i.source_url}>{i.source} ↗</SourceLink>
          </Glass>
        );
      })}
      <Copy size={12} muted>
        指标升降不是投资收益。官方数据可修订，走势图采用当前可用版本。最近检查：
        {r.data?.fetched_at || "未提供"}
      </Copy>
    </Page>
  );
}
