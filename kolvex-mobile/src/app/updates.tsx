import { useState } from "react";
import { router } from "expo-router";
import { catalogue } from "../lib/featureApi";
import { holdings } from "../lib/contentApi";
import { useResource } from "../lib/useResource";
import { useAuth } from "../state/Auth";
import { number } from "../lib/models";
import { Page, Copy, Glass, Button } from "../components/UI";
import { Filters, ResourceState, AuthGate } from "../components/Content";
import { OpinionCard } from "../components/OpinionCard";
export default function Updates() {
  const [scope, setScope] = useState("all");
  return (
    <Page
      title="观点动态"
      subtitle="比较相邻有观点日期的变化，首次观点单独标记。"
    >
      <Filters
        values={[
          ["all", "全部股票"],
          ["holdings", "我的持仓"],
        ]}
        value={scope}
        onChange={setScope}
      />
      {scope === "holdings" ? (
        <AuthGate inline title="持仓观点动态">
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
  const changes = (r.data?.data.changes ?? []).filter(
    (c) => !r.data?.symbols || r.data.symbols.has(c.ticker),
  );
  return (
    <>
      <ResourceState
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
          <Copy>
            {c.change == null
              ? "首次出现观点"
              : `${c.previous_date} ${number(c.previous_score)} → ${number(c.current_score)} · 变化 ${number(c.change)}`}
          </Copy>
          <Copy muted>
            {c.opinion_count} 条观点；分数表示来源倾向，不是收益率。
          </Copy>
          <Button onPress={() => router.push(`/stock/${c.ticker}`)}>
            查看研究与来源
          </Button>
        </Glass>
      ))}
      {r.data?.data.latest
        .filter((o) => !r.data?.symbols || r.data.symbols.has(o.ticker))
        .map((o) => (
          <OpinionCard key={o.id} item={o} />
        ))}
    </>
  );
}
