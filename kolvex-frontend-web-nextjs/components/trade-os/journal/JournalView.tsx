"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useCopy } from "@/components/decision/shared";
import {
  fetchAccounts,
  fetchJournal,
  submitJournalReview,
  TradingAccount,
  JournalEntry,
} from "@/lib/tradeOsApi";
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileText,
  Star,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { withSign } from "@/lib/format";

export function JournalView() {
  const c = useCopy();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeReviewEntry, setActiveReviewEntry] = useState<JournalEntry | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  // Review modal state
  const [rating, setRating] = useState<string>("good");
  const [score, setScore] = useState<number>(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>("");

  const t = {
    title: c("Trade Journal & Post-Trade Reviews", "交易日志与复盘归集"),
    subtitle: c(
      "Reconciles every trade against approved plans, tags outside-plan executions, and tracks R-multiples.",
      "全量对账归集成交，自动关联交易计划并标记计划外（Outside Plan）操作与 R 倍数。",
    ),
    account: c("Account", "账户"),
    symbol: c("Symbol", "标的"),
    status: c("Status", "状态"),
    qty: c("Quantity", "成交股数"),
    cost: c("Cost", "均价"),
    exit: c("Exit", "出场价"),
    pnl: c("Realized PnL", "已实现盈亏"),
    planStatus: c("Plan Fidelity", "计划执行"),
    rMultiple: c("Realized R", "实现 R 倍数"),
    action: c("Action", "操作"),
    review: c("Review", "复盘"),
    reviewed: c("Reviewed", "已复盘"),
    outsidePlan: c("Outside Plan", "计划外交易"),
    planned: c("Plan Matched", "符合计划"),
    empty: c("No trade groups found for this account.", "该账户暂无归集成交记录。"),
  };

  const MISTAKE_OPTIONS = [
    { id: "fomo", labelEn: "FOMO Entry", labelZh: "情绪冲动入场" },
    { id: "early_exit", labelEn: "Early Exit", labelZh: "过早离场" },
    { id: "moved_stop", labelEn: "Moved Stop", labelZh: "下移止损" },
    { id: "chased_entry", labelEn: "Chased Price", labelZh: "追高进场" },
    { id: "oversized", labelEn: "Oversized", labelZh: "仓位超标" },
  ];

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
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

  const loadJournal = useCallback(async (accId: string) => {
    try {
      setLoading(true);
      const items = await fetchJournal(accId);
      setEntries(items);
    } catch (err) {
      console.error("Failed to load journal", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedAccountId) {
      loadJournal(selectedAccountId);
    }
  }, [selectedAccountId, loadJournal]);

  const openReviewModal = (entry: JournalEntry) => {
    setActiveReviewEntry(entry);
    if (entry.review) {
      setRating(entry.review.execution_rating || "good");
      setScore(entry.review.discipline_score || 5);
      setSelectedTags(entry.review.mistake_tags || []);
      setNotes(entry.review.notes || "");
    } else {
      setRating("good");
      setScore(5);
      setSelectedTags([]);
      setNotes("");
    }
  };

  const handleToggleTag = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((t) => t !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  const handleSubmitReview = async () => {
    if (!activeReviewEntry) return;
    try {
      setSubmittingReview(true);
      await submitJournalReview({
        trade_group_id: activeReviewEntry.trade_group_id,
        execution_rating: rating,
        discipline_score: score,
        mistake_tags: selectedTags,
        notes,
      });
      if (selectedAccountId) {
        await loadJournal(selectedAccountId);
      }
      setActiveReviewEntry(null);
    } catch (err) {
      console.error("Failed to submit review", err);
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Account Selection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            {t.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{t.subtitle}</p>
        </div>

        {accounts.length > 0 && (
          <select
            value={selectedAccountId || ""}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_name} ({a.broker})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Journal Table */}
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" />
            Loading Journal...
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t.empty}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border/30">
                <tr>
                  <th className="px-4 py-3 font-medium">{t.symbol}</th>
                  <th className="px-4 py-3 font-medium">{t.qty}</th>
                  <th className="px-4 py-3 font-medium">{t.cost}</th>
                  <th className="px-4 py-3 font-medium">{t.exit}</th>
                  <th className="px-4 py-3 font-medium">{t.pnl}</th>
                  <th className="px-4 py-3 font-medium">{t.planStatus}</th>
                  <th className="px-4 py-3 font-medium">{t.rMultiple}</th>
                  <th className="px-4 py-3 font-medium">{t.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20 text-foreground">
                {entries.map((entry) => {
                  const pnl = parseFloat(entry.realized_pnl);
                  return (
                    <tr key={entry.trade_group_id} className="hover:bg-muted/20 transition">
                      <td className="px-4 py-3 font-bold text-foreground">
                        {entry.symbol}
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono">{entry.total_quantity}</td>
                      <td className="px-4 py-3 font-mono">${entry.average_cost}</td>
                      <td className="px-4 py-3 font-mono">
                        {entry.status === "closed" ? `$${entry.average_exit_price}` : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 font-semibold ${
                          pnl > 0
                            ? "text-emerald-500"
                            : pnl < 0
                              ? "text-rose-500"
                              : "text-muted-foreground"
                        }`}
                      >
                        {withSign(pnl, (m) => `$${m.toFixed(2)}`)}
                      </td>
                      <td className="px-4 py-3">
                        {entry.planned ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            {t.planned}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                            <AlertTriangle className="w-3 h-3" />
                            {t.outsidePlan}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {entry.realized_r !== null ? (
                          <span
                            className={`font-semibold ${
                              entry.realized_r >= 0 ? "text-emerald-500" : "text-rose-500"
                            }`}
                          >
                            {withSign(entry.realized_r, (m) => `${m.toFixed(2)}R`)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openReviewModal(entry)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium border transition ${
                            entry.review
                              ? "bg-muted text-foreground border-border hover:bg-muted/80"
                              : "bg-primary text-primary-foreground border-primary hover:opacity-90"
                          }`}
                        >
                          <FileText className="w-3 h-3" />
                          {entry.review ? t.reviewed : t.review}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {activeReviewEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Trade Review: {activeReviewEntry.symbol}
                </h3>
                <span className="text-xs text-muted-foreground">
                  PnL:{" "}
                  {withSign(parseFloat(activeReviewEntry.realized_pnl), (m) => `$${m.toFixed(2)}`)}
                </span>
              </div>
              <button
                onClick={() => setActiveReviewEntry(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Discipline Rating & Score */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Execution Rating</span>
                <select
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="rounded border border-border bg-muted/40 px-2 py-1 text-xs text-foreground focus:outline-none"
                >
                  <option value="excellent">Excellent (无违纪完美执行)</option>
                  <option value="good">Good (合规执行)</option>
                  <option value="fair">Fair (微小偏离)</option>
                  <option value="poor">Poor (严重违规/情绪化)</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Discipline Score</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScore(s)}
                      className={`p-1 rounded ${
                        score >= s ? "text-amber-500" : "text-muted-foreground/40"
                      }`}
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mistake Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                Mistake & Execution Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {MISTAKE_OPTIONS.map((opt) => {
                  const active = selectedTags.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleToggleTag(opt.id)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${
                        active
                          ? "bg-rose-500/15 border-rose-500/40 text-rose-500 font-semibold"
                          : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {opt.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trader Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Trader Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Document your psychological state, execution deviations, or lessons learned..."
                rows={3}
                className="w-full rounded-lg border border-border bg-muted/30 p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Existing AI Review Preview */}
            {activeReviewEntry.review?.ai_review && (
              <div className="space-y-2 p-3 rounded-lg bg-muted/40 border border-border/40 text-xs">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  AI Retrospective Analysis
                </div>
                <div className="text-muted-foreground whitespace-pre-line leading-relaxed">
                  {activeReviewEntry.review.ai_review}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-border/40">
              <button
                type="button"
                onClick={() => setActiveReviewEntry(null)}
                className="px-4 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={submittingReview}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
              >
                {submittingReview ? "Saving..." : "Save Review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
