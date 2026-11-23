"use client";

import { useState } from "react";
import { useCopy } from "@/components/decision/shared";
import { TradingAccount, createAccount } from "@/lib/tradeOsApi";
import { Plus, Wallet, ShieldCheck, RefreshCw } from "lucide-react";

interface AccountSetupProps {
  accounts: TradingAccount[];
  selectedAccountId: string | null;
  onSelectAccount: (id: string) => void;
  onAccountCreated: () => void;
}

export function AccountSetup({
  accounts,
  selectedAccountId,
  onSelectAccount,
  onAccountCreated,
}: AccountSetupProps) {
  const c = useCopy();
  const [showModal, setShowModal] = useState(false);
  const [broker, setBroker] = useState("robinhood");
  const [accountName, setAccountName] = useState("Robinhood Primary");
  const [initialEquity, setInitialEquity] = useState("30000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createAccount({
        broker,
        account_name: accountName,
        account_type: "manual",
        initial_equity: parseFloat(initialEquity) || null,
        execution_capability: "manual",
      });
      setShowModal(false);
      onAccountCreated();
    } catch (err: any) {
      setError(err?.message || c("Failed to create account", "创建账户失败"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4 text-emerald-500" />
            {c("Trading Accounts", "交易账户")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {c(
              "Manage manual trading ledgers and connected brokerage accounts.",
              "管理手动记账与券商导入的交易账户。",
            )}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {c("New Account", "新建账户")}
        </button>
      </div>

      {/* Account pills / list */}
      <div className="pt-4">
        {accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-foreground">
              {c("No Trading Accounts Yet", "尚未创建交易账户")}
            </p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              {c(
                "Create your first account to record equity snapshots and import Robinhood history.",
                "创建第一个交易账户以记录权益快照并导入 Robinhood 交易记录。",
              )}
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              <Plus className="h-3.5 w-3.5" />
              {c("Set Up First Account", "设置首个账户")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((acc) => {
              const isSelected = acc.id === selectedAccountId;
              return (
                <div
                  key={acc.id}
                  onClick={() => onSelectAccount(acc.id)}
                  className={`cursor-pointer rounded-lg border p-3.5 transition-all ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500"
                      : "border-border bg-background hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-foreground truncate">
                      {acc.account_name}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[0.625rem] font-medium text-muted-foreground capitalize">
                      {acc.broker}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between text-xs">
                    <span className="text-muted-foreground">
                      {c("Initial Equity", "期初权益")}:
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {acc.initial_equity != null
                        ? `$${Number(acc.initial_equity).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })}`
                        : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Account Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="text-base font-semibold text-foreground mb-1">
              {c("Create Trading Account", "新建交易账户")}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {c(
                "Initial equity is used to calibrate risk limits and calculate drawdown.",
                "期初权益将用于计算风险额度与真实回撤。",
              )}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {c("Broker / Provider", "券商 / 平台")}
                </label>
                <select
                  value={broker}
                  onChange={(e) => setBroker(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="robinhood">Robinhood</option>
                  <option value="manual">Manual / Generic</option>
                  <option value="ibkr">Interactive Brokers</option>
                  <option value="schwab">Charles Schwab</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {c("Account Name", "账户名称")}
                </label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Robinhood Swing"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  {c("Initial Equity ($ USD)", "期初权益 ($ 美元)")}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={initialEquity}
                  onChange={(e) => setInitialEquity(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  placeholder="30000.00"
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  {c("Cancel", "取消")}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {c("Save Account", "保存账户")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
