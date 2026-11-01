import { router } from "expo-router";
import { useAuth } from "../state/Auth";
import { holdings } from "../lib/contentApi";
import { useResource } from "../lib/useResource";
import { isSymbol, number } from "../lib/models";
import { AuthGate, ResourceState } from "../components/Content";
import { Button, Copy, Empty, Glass, Page, Section } from "../components/UI";
export default function Portfolio() {
  return (
    <AuthGate title="投资组合">
      <Positions />
    </AuthGate>
  );
}
function Positions() {
  const user = useAuth().session!.user.id;
  const resource = useResource(user, (signal) => holdings(user, signal));
  const data = resource.data;
  return (
    <Page
      title="投资组合"
      subtitle="查看已连接账户的持仓快照。"
      onRefresh={resource.refresh}
      refreshing={resource.loading && !!data}
    >
      <ResourceState resource={resource} empty={false} message="" />
      {data && !data.is_connected && (
        <Empty
          title="尚未连接投资账户"
          message="请先在网页版连接券商账户，再返回手机端刷新。手机端暂不发起新的券商授权。"
        />
      )}
      {data?.is_connected && (
        <>
          <Glass style={{ padding: 24, gap: 8 }}>
            <Copy size={14} muted>
              组合总市值（币种未提供）
            </Copy>
            <Copy size={36} bold>
              {typeof data.total_value === "number"
                ? number(data.total_value)
                : (data.total_value ?? "—")}
            </Copy>
            <Copy size={12} muted>
              同步于{" "}
              {data.last_synced_at
                ? new Date(data.last_synced_at).toLocaleString("zh-CN")
                : "未提供"}
            </Copy>
          </Glass>
          {!data.accounts.length && (
            <Empty title="暂无持仓" message="已连接的账户尚未返回持仓数据。" />
          )}
          {data.accounts.map((account) => (
            <Glass key={account.id} style={{ padding: 20, gap: 16 }}>
              <Section
                title={account.account_name || "投资账户"}
                note={account.brokerage_name}
              />
              {!account.portfolio_positions?.length && (
                <Copy muted>此账户暂无持仓。</Copy>
              )}
              {account.portfolio_positions?.map((position) => (
                <Glass key={position.id} style={{ padding: 16, gap: 8 }}>
                  <Copy bold>{position.symbol}</Copy>
                  <Copy size={14} muted>
                    {position.security_name || "名称未提供"}
                  </Copy>
                  <Copy>
                    数量 {number(position.units, 4)} · 价格{" "}
                    {number(position.price)} {position.currency ?? ""}
                  </Copy>
                  <Copy>
                    市值 {number(position.market_value)} · 浮动盈亏{" "}
                    {number(position.open_pnl)}
                  </Copy>
                  {position.position_type === "option" && (
                    <Copy size={12} muted>
                      {position.option_type ?? ""} · 行权价{" "}
                      {number(position.strike_price)} · 到期{" "}
                      {position.expiration_date ?? "—"}
                    </Copy>
                  )}
                  {isSymbol(position.underlying_symbol || position.symbol) && (
                    <Button
                      onPress={() =>
                        router.push(
                          `/stock/${encodeURIComponent(position.underlying_symbol || position.symbol)}`,
                        )
                      }
                    >
                      查看股票
                    </Button>
                  )}
                </Glass>
              ))}
            </Glass>
          ))}
          <Copy size={12} muted>
            持仓为账户同步快照，价格和市值可能存在延迟。手机端不会下单。
          </Copy>
        </>
      )}
    </Page>
  );
}
