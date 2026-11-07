import { useState } from "react";
import { CardsSkeleton } from "../components/Skeletons";
import { View } from "react-native";
import { router } from "expo-router";
import { catalogue } from "../lib/featureApi";
import { holdings } from "../lib/contentApi";
import { useResource } from "../lib/useResource";
import { useAuth } from "../state/Auth";
import { OpinionStrength } from "../components/OpinionStrength";
import { Page, Copy, Glass, Button, Section } from "../components/UI";
import { Filters, ResourceState, AuthGate } from "../components/Content";
import { portfolioEnabled } from "../lib/productFeatures";
import { OpinionCard } from "../components/OpinionCard";
export default function Updates() {
  const [scope, setScope] = useState("all");
  return (
    <Page
      title="观点动态"
      subtitle="比较相邻有观点日期的变化，首次观点单独标记。"
    >
      {portfolioEnabled && (
        <Filters
          values={[
            ["all", "全部股票"],
            ["holdings", "我的持仓"],
          ]}
          value={scope}
          onChange={setScope}
        />
      )}
      {scope === "holdings" ? (
        <AuthGate skeleton={<CardsSkeleton lines={[{ size: 16, width: "30%" }, { size: 16, width: "40%" }, { size: 12, width: "50%" }]} />} inline title="持仓观点动态">
          <Feed held />
        </AuthGate>
      ) : (
        <Feed held={false} />
      )}
    </Page>
  );
}
function Feed({ held }: { held: boolean }) {
  const auth = useAuth();
  const user = auth.session?.user.id;
  const r = useResource(`updates:${user}:${held}`, async (signal) => {
    const data = await catalogue(signal);
    const h = held && user ? await holdings(user, signal) : null;
    return {
      data,
      symbols: h
        ? new Set(
            h.accounts
              .flatMap((a) => a.portfolio_positions ?? [])
              .map((p) => p.symbol),
          )
        : null,
    };
  });
  const changes = (r.data?.data.changes ?? [])
    .filter((c) => !r.data?.symbols || r.data.symbols.has(c.ticker))
    .sort((a, b) => b.current_date.localeCompare(a.current_date));
  const latest = (r.data?.data.latest ?? [])
    .filter((o) => !r.data?.symbols || r.data.symbols.has(o.ticker))
    .sort((a, b) => b.opinion_date.localeCompare(a.opinion_date));
  return (
    <>
      <ResourceState skeleton={<CardsSkeleton lines={[{ size: 16, width: "30%" }, { size: 16, width: "40%" }, { size: 12, width: "50%" }]} />}
        resource={r}
        empty={!changes.length}
        message={held ? "暂无持仓对应的观点变化。" : "暂无观点变化。"}
      />
      {changes.map((c) => (
        <Glass
          key={`${c.ticker}:${c.current_date}`}
          style={{ padding: 20, gap: 12 }}
        >
          <Copy bold>
            {c.ticker} · {c.current_date}
          </Copy>
          {c.change == null ? (
            <>
              <OpinionStrength value={c.current_score} />
              <Copy size={12} muted>
                首次出现观点
              </Copy>
            </>
          ) : (
            <>
              <OpinionStrength value={c.change} change />
              <Copy size={12} muted>
                {c.previous_date || c.current_date}
              </Copy>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <OpinionStrength value={c.previous_score} />
                <Copy size={12} muted localize={false}>
                  →
                </Copy>
                <OpinionStrength value={c.current_score} />
              </View>
            </>
          )}
          <Copy muted>{`${c.opinion_count} 条观点`}</Copy>
          <Button onPress={() => router.push(`/stock/${c.ticker}`)}>
            查看研究与来源
          </Button>
        </Glass>
      ))}
      {!!latest.length && <Section title="最新观点" />}
      {latest.map((o) => (
        <OpinionCard key={o.id} item={o} />
      ))}
    </>
  );
}
