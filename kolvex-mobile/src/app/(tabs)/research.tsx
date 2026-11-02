import { useState } from "react";
import { router } from "expo-router";
import { useAuth } from "../../state/Auth";
import { reports, publicReports } from "../../lib/contentApi";
import { useResource } from "../../lib/useResource";
import { Pager, ResourceState } from "../../components/Content";
import { Button, Copy, Glass, Page, Search } from "../../components/UI";
export default function Research() {
  return <Library />;
}
function Library() {
  const user = useAuth().session?.user.id;
  const [page, setPage] = useState(1);
  const [input, setInput] = useState("");
  const [ticker, setTicker] = useState("");
  const resource = useResource(`reports:${user}:${page}:${ticker}`, (signal) =>
    user
      ? reports(signal, user, (page - 1) * 20, ticker)
      : publicReports(signal, (page - 1) * 20, ticker),
  );
  const rows = resource.data?.items ?? [];
  return (
    <Page
      title="AI 研究"
      subtitle="沿着证据，读懂不同的判断。"
      refreshing={resource.loading && !!resource.data}
      onRefresh={resource.refresh}
    >
      <Button onPress={() => router.push("/research-tasks")}>
        创建研究 / 我的任务
      </Button>
      <Search
        value={input}
        onChange={(v) => {
          setInput(v);
          if (!v.trim()) {
            setTicker("");
            setPage(1);
          }
        }}
        onSubmit={() => {
          setTicker(input.trim().toUpperCase());
          setPage(1);
        }}
      />
      <Button
        onPress={() => {
          setTicker(input.trim().toUpperCase());
          setPage(1);
        }}
      >
        按股票筛选
      </Button>
      <ResourceState
        resource={resource}
        empty={!rows.length}
        message="当前筛选下没有已完成的研究报告。"
      />
      {rows.map((item) => (
        <Glass key={item.id} style={{ padding: 20, gap: 12 }}>
          <Copy size={24} bold>
            {item.ticker}
          </Copy>
          <Copy size={14} muted>
            {item.trade_date} ·{" "}
            {item.author?.full_name || item.author?.username || "Kolvex 研究"}
          </Copy>
          <Copy size={14}>
            {item.final_decision
              ? item.final_decision.slice(0, 240)
              : "市场、新闻、情绪及基本面研究"}
          </Copy>
          <Button
            onPress={() =>
              router.push(`/report/${encodeURIComponent(item.id)}`)
            }
          >
            阅读报告
          </Button>
        </Glass>
      ))}
      <Pager
        page={page}
        hasMore={page * 20 < (resource.data?.total ?? 0)}
        loading={resource.loading}
        onChange={setPage}
      />
      <Copy size={12} muted>
        AI 输出可能存在错误。请结合原始资料自行核实。
      </Copy>
    </Page>
  );
}
