"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAnalysis, getAnalysisHistory, startStockAnalysis, type TradingAnalysis } from "@/lib/tradingAnalysisApi";
import { useStockHistory } from "./AnalysisHistory";

export function useStockResearch(ticker: string) {
  const history = useStockHistory<TradingAnalysis>(ticker, "research");
  const [job, setJob] = useState<TradingAnalysis | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(false);
  const mounted = useRef(0);
  const startingRef = useRef(false);
  useEffect(() => {
    const token = ++mounted.current;
    setJob(null); setError(false); setStarting(false); startingRef.current = false;
    getAnalysisHistory({ ticker, limit: 100 }).then(data => {
      if (token === mounted.current) setJob(data.items.find(item => item.status === "running" || item.status === "pending") || null);
    }).catch(() => { /* History panel provides authenticated error recovery. */ });
    return () => { mounted.current += 1; };
  }, [ticker]);
  const load = history.load;
  const jobId = job?.id;
  const jobStatus = job?.status;
  useEffect(() => {
    if (!jobId || !jobStatus || !["running", "pending"].includes(jobStatus)) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const record = await getAnalysis(jobId!);
        if (!alive) return;
        setJob(record); setError(false);
        if (record.status === "completed") await load(0, record.id);
        else if (record.status !== "failed") timer = setTimeout(poll, 3000);
      } catch {
        if (alive) { setError(true); timer = setTimeout(poll, 10000); }
      }
    }
    timer = setTimeout(poll, 3000);
    return () => { alive = false; clearTimeout(timer); };
  }, [jobId, jobStatus, load]);
  const generate = useCallback(async () => {
    if (startingRef.current || (job && ["pending", "running"].includes(job.status))) return;
    const token = mounted.current;
    startingRef.current = true; setStarting(true); setError(false);
    try {
      const today = new Date();
      const date = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
      const result = await startStockAnalysis(ticker, date);
      if (token === mounted.current) setJob(result);
    } catch { if (token === mounted.current) setError(true); }
    finally { if (token === mounted.current) { startingRef.current = false; setStarting(false); } }
  }, [ticker, job]);
  return { history, job, busy: starting || !!job && ["pending", "running"].includes(job.status), error, generate };
}
