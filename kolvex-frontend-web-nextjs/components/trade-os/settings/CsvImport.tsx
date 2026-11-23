"use client";

import { useState, useRef } from "react";
import { useCopy } from "@/components/decision/shared";
import { uploadRobinhoodCsv } from "@/lib/tradeOsApi";
import { UploadCloud, CheckCircle2, AlertTriangle, FileSpreadsheet, RefreshCw } from "lucide-react";

interface CsvImportProps {
  accountId: string | null;
  accountName?: string;
  onImportCompleted: () => void;
}

export function CsvImport({ accountId, accountName, onImportCompleted }: CsvImportProps) {
  const c = useCopy();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!accountId || !selectedFile) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const res = await uploadRobinhoodCsv(accountId, selectedFile);
      setResult(res);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onImportCompleted();
    } catch (err: any) {
      setError(err?.message || c("CSV import failed", "CSV 导入失败"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <UploadCloud className="h-4 w-4 text-emerald-500" />
            {c("Import Robinhood Activity CSV", "导入 Robinhood 交易流水 CSV")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {c(
              "Upload official Robinhood Account Activity CSV export to reconcile trades, deposits, and dividends.",
              "上传 Robinhood 官方账户活动报告 CSV，自动归集交易、出入金与股息记录。",
            )}
          </p>
        </div>
      </div>

      <div className="pt-4">
        {!accountId ? (
          <div className="rounded-lg bg-muted/40 p-4 text-center text-xs text-muted-foreground">
            {c(
              "Please select or create an account above before importing.",
              "请先在上方选择或创建交易账户，再进行导入。",
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upload Box */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-lg border-2 border-dashed border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 p-6 text-center transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
              {selectedFile ? (
                <div>
                  <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(selectedFile.size / 1024).toFixed(1)} KB —{" "}
                    {c("Click to change file", "点击更换文件")}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {c("Select or drop Robinhood CSV here", "选择或拖放 Robinhood CSV 文件到此处")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {c("Target account: ", "目标账户：")}
                    <span className="font-medium text-foreground">{accountName || accountId}</span>
                  </p>
                </div>
              )}
            </div>

            {selectedFile && (
              <div className="flex justify-end">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      {c("Processing & Reconciling...", "正在解析并对账...")}
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-3.5 w-3.5" />
                      {c("Start Import", "开始导入")}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success summary card */}
            {result && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-foreground space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{c("Import Completed Successfully", "导入成功完成")}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center">
                  <div className="rounded bg-background p-2 border border-border">
                    <p className="text-[0.625rem] text-muted-foreground">
                      {c("Imported Fills", "已入库成交")}
                    </p>
                    <p className="text-sm font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {result.imported_executions_count}
                    </p>
                  </div>
                  <div className="rounded bg-background p-2 border border-border">
                    <p className="text-[0.625rem] text-muted-foreground">
                      {c("Duplicates Skipped", "跳过重复")}
                    </p>
                    <p className="text-sm font-mono font-semibold text-muted-foreground">
                      {result.duplicate_executions_count}
                    </p>
                  </div>
                  <div className="rounded bg-background p-2 border border-border">
                    <p className="text-[0.625rem] text-muted-foreground">
                      {c("Cash Movements", "资金流水")}
                    </p>
                    <p className="text-sm font-mono font-semibold text-foreground">
                      {result.cash_flows_count}
                    </p>
                  </div>
                  <div className="rounded bg-background p-2 border border-border">
                    <p className="text-[0.625rem] text-muted-foreground">
                      {c("Trade Groups Formed", "生成交易组")}
                    </p>
                    <p className="text-sm font-mono font-semibold text-foreground">
                      {result.trade_groups_count}
                    </p>
                  </div>
                </div>
                {result.issues_count > 0 && (
                  <p className="text-amber-600 dark:text-amber-400 text-[0.6875rem] pt-1">
                    ⚠️ {result.issues_count}{" "}
                    {c("reconciliation issues flagged below.", "条对账异常已记录在下方。")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
