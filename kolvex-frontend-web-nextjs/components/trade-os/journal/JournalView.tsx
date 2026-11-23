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
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListCard, ListEmptyState } from "@/components/ui/list-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";

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
      {/* Account Selection Toolbar */}
      {accounts.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">
              {c("Trading Account", "交易账户")}:
            </span>
            <Select
              value={selectedAccountId || ""}
              onValueChange={(val) => setSelectedAccountId(val)}
            >
              <SelectTrigger className="h-9 w-[220px] rounded-full text-xs font-medium">
                <SelectValue placeholder={c("Select account", "选择账户")} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs font-medium">
                    {a.account_name} ({a.broker})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Journal Table inside ListCard */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            {t.title}
          </h2>
        </div>

        <ListCard>
          {loading ? (
            <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              {c("Loading Journal...", "正在加载交易日志...")}
            </div>
          ) : entries.length === 0 ? (
            <ListEmptyState
              title={c("No trades in journal", "暂无交易日志")}
              description={t.empty}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted-foreground border-b border-border/40 font-medium">
                  <tr>
                    <th className="px-3 py-3">{t.symbol}</th>
                    <th className="px-3 py-3">{t.qty}</th>
                    <th className="px-3 py-3">{t.cost}</th>
                    <th className="px-3 py-3">{t.exit}</th>
                    <th className="px-3 py-3">{t.pnl}</th>
                    <th className="px-3 py-3">{t.planStatus}</th>
                    <th className="px-3 py-3">{t.rMultiple}</th>
                    <th className="px-3 py-3 text-right">{t.action}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30 text-foreground font-mono">
                  {entries.map((entry) => {
                    const pnl = parseFloat(entry.realized_pnl);
                    return (
                      <tr key={entry.trade_group_id} className="hover:bg-muted/20 transition">
                        <td className="px-3 py-3 font-semibold text-foreground tracking-tight">
                          {entry.symbol}
                          <span className="block text-[11px] font-normal text-muted-foreground font-sans">
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 figure">{entry.total_quantity}</td>
                        <td className="px-3 py-3 figure">${entry.average_cost}</td>
                        <td className="px-3 py-3 figure">
                          {entry.status === "closed" ? `$${entry.average_exit_price}` : "—"}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-3 font-semibold figure",
                            pnl > 0
                              ? "text-positive"
                              : pnl < 0
                                ? "text-negative"
                                : "text-muted-foreground",
                          )}
                        >
                          {withSign(pnl, (m) => `$${m.toFixed(2)}`)}
                        </td>
                        <td className="px-3 py-3 font-sans">
                          {entry.planned ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-positive border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              {t.planned}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-negative/10 text-negative border border-negative/20">
                              <AlertTriangle className="w-3 h-3" />
                              {t.outsidePlan}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 figure">
                          {entry.realized_r !== null ? (
                            <span
                              className={cn(
                                "font-semibold",
                                entry.realized_r >= 0 ? "text-positive" : "text-negative",
                              )}
                            >
                              {withSign(entry.realized_r, (m) => `${m.toFixed(2)}R`)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-sans">
                          <Button
                            size="sm"
                            variant={entry.review ? "outline" : "default"}
                            onClick={() => openReviewModal(entry)}
                            className="h-7 rounded-full px-2.5 text-xs gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            {entry.review ? t.reviewed : t.review}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </ListCard>
      </section>

      {/* Review Modal */}
      {activeReviewEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-foreground/10 bg-card-glass glass-card p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Trade Review: {activeReviewEntry.symbol}
                </h3>
                <span className="figure text-xs text-muted-foreground">
                  PnL:{" "}
                  {withSign(parseFloat(activeReviewEntry.realized_pnl), (m) => `$${m.toFixed(2)}`)}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActiveReviewEntry(null)}
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Discipline Rating & Score */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">Execution Rating</span>
                <select
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="rounded-xl border border-input bg-background/50 px-2.5 py-1 text-xs text-foreground focus:outline-none"
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
                      className={cn(
                        "text-xs px-3 py-1 rounded-full border transition",
                        active
                          ? "bg-negative/15 border-negative/40 text-negative font-semibold"
                          : "bg-muted/40 border-border text-muted-foreground hover:text-foreground",
                      )}
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
                className="w-full rounded-2xl border border-input bg-background/50 p-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {/* Existing AI Review Preview */}
            {activeReviewEntry.review?.ai_review && (
              <div className="space-y-2 p-3.5 rounded-2xl bg-muted/40 border border-foreground/5 text-xs">
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
            <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveReviewEntry(null)}
                className="rounded-full px-4 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitReview}
                disabled={submittingReview}
                className="rounded-full px-5 text-xs font-semibold"
              >
                {submittingReview ? "Saving..." : "Save Review"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
