"use client";

import { useEffect, useState, useCallback } from "react";
import { useCopy } from "@/components/decision/shared";
import {
  TradingAccount,
  TradeGroup,
  ReconciliationIssue,
  fetchAccounts,
  fetchTradeGroups,
  fetchReconciliationIssues,
} from "@/lib/tradeOsApi";
import { AccountSetup } from "@/components/trade-os/settings/AccountSetup";
import { CsvImport } from "@/components/trade-os/settings/CsvImport";
import { ReconciliationView } from "@/components/trade-os/settings/ReconciliationView";

export default function TradeOsSettingsPage() {
  const c = useCopy();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [tradeGroups, setTradeGroups] = useState<TradeGroup[]>([]);
  const [issues, setIssues] = useState<ReconciliationIssue[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    try {
      const accs = await fetchAccounts();
      setAccounts(accs);
      if (accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0].id);
      }
    } catch (err) {
      console.error("Failed to load accounts", err);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  const loadAccountDetails = useCallback(async (accId: string) => {
    try {
      const [groups, iss] = await Promise.all([
        fetchTradeGroups(accId),
        fetchReconciliationIssues(accId),
      ]);
      setTradeGroups(groups);
      setIssues(iss);
    } catch (err) {
      console.error("Failed to load account details", err);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountDetails(selectedAccountId);
    } else {
      setTradeGroups([]);
      setIssues([]);
    }
  }, [selectedAccountId, loadAccountDetails]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="space-y-6">
      {/* Account Setup */}
      <AccountSetup
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccountId}
        onAccountCreated={loadAccounts}
      />

      {/* CSV Import */}
      <CsvImport
        accountId={selectedAccountId}
        accountName={selectedAccount?.account_name}
        onImportCompleted={() => {
          if (selectedAccountId) loadAccountDetails(selectedAccountId);
        }}
      />

      {/* Reconciled Trades and Issues */}
      {selectedAccountId && (
        <ReconciliationView tradeGroups={tradeGroups} issues={issues} loading={loading} />
      )}
    </div>
  );
}
