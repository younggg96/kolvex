"use client";

import { useState } from "react";
import { useCopy } from "@/components/decision/shared";
import { TradingAccount, createAccount } from "@/lib/tradeOsApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Wallet, ShieldCheck, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <Card className="p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border/50">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            {c("Trading Accounts", "交易账户")}
          </h2>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          size="sm"
          className="rounded-full px-3.5 text-xs font-semibold gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          {c("New Account", "新建账户")}
        </Button>
      </div>

      {/* Account pills / list */}
      <div>
        {accounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center">
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
            <Button
              onClick={() => setShowModal(true)}
              size="sm"
              className="rounded-full px-4 text-xs font-semibold gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {c("Set Up First Account", "设置首个账户")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((acc) => {
              const isSelected = acc.id === selectedAccountId;
              return (
                <div
                  key={acc.id}
                  onClick={() => onSelectAccount(acc.id)}
                  className={cn(
                    "cursor-pointer rounded-2xl border p-4 transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-foreground/10 bg-muted/20 hover:border-foreground/20",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {acc.account_name}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground capitalize">
                      {acc.broker}
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline justify-between text-xs">
                    <span className="text-muted-foreground">
                      {c("Initial Equity", "期初权益")}:
                    </span>
                    <span className="figure font-semibold text-foreground">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-foreground/10 bg-card-glass glass-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="text-base font-semibold text-foreground">
                {c("Create Trading Account", "新建交易账户")}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowModal(false)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  {c("Broker / Provider", "券商 / 平台")}
                </label>
                <Select value={broker} onValueChange={(val) => setBroker(val)}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="robinhood" className="text-xs">
                      Robinhood
                    </SelectItem>
                    <SelectItem value="manual" className="text-xs">
                      Manual / Generic
                    </SelectItem>
                    <SelectItem value="ibkr" className="text-xs">
                      Interactive Brokers
                    </SelectItem>
                    <SelectItem value="schwab" className="text-xs">
                      Charles Schwab
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  {c("Account Name", "账户名称")}
                </label>
                <Input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="h-10 rounded-xl text-xs"
                  placeholder="e.g. Robinhood Swing"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  {c("Initial Equity ($ USD)", "期初权益 ($ 美元)")}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={initialEquity}
                  onChange={(e) => setInitialEquity(e.target.value)}
                  className="h-10 rounded-xl font-mono text-xs"
                  placeholder="30000.00"
                />
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModal(false)}
                  className="rounded-full px-4 text-xs"
                >
                  {c("Cancel", "取消")}
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  size="sm"
                  className="rounded-full px-5 text-xs font-semibold gap-1.5"
                >
                  {loading && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {c("Save Account", "保存账户")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
