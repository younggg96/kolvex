"use client";

import { useCallback, useEffect, useState } from "react";
import { useCopy } from "@/components/decision/shared";
import { fetchAccounts, TradingAccount } from "@/lib/tradeOsApi";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STORAGE_KEY = "tradeOs.accountId";

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(id: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode or blocked storage: the choice just won't be remembered.
  }
}

/** Trading accounts plus the selected one, remembered across Trade OS pages. */
export function useTradeAccount() {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [accountId, setAccountIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const accs = await fetchAccounts();
      setAccounts(accs);
      const stored = readStored();
      setAccountIdState((current) => {
        const keep = [current, stored].find((id) => id && accs.some((a) => a.id === id));
        return keep ?? accs[0]?.id ?? null;
      });
    } catch (err: any) {
      setError(err?.message || "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const setAccountId = useCallback((id: string) => {
    setAccountIdState(id);
    writeStored(id);
  }, []);

  const account = accounts.find((a) => a.id === accountId) ?? null;
  return { accounts, account, accountId, setAccountId, loading, error, reload };
}

export function AccountPicker({
  accounts,
  accountId,
  onChange,
}: {
  accounts: TradingAccount[];
  accountId: string | null;
  onChange: (id: string) => void;
}) {
  const c = useCopy();
  if (accounts.length < 2) {
    const only = accounts[0];
    return only ? (
      <span className="text-xs font-medium text-muted-foreground">{only.account_name}</span>
    ) : null;
  }
  return (
    <Select value={accountId ?? ""} onValueChange={onChange}>
      <SelectTrigger
        aria-label={c("Trading account", "交易账户")}
        className="h-9 w-[200px] rounded-full text-xs font-medium"
      >
        <SelectValue placeholder={c("Select account", "选择账户")} />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((a) => (
          <SelectItem key={a.id} value={a.id} className="text-xs font-medium">
            {a.account_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
