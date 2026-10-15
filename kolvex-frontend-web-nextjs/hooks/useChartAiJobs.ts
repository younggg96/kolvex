"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AiAnalysisError, getAiChartJobs, submitAiChartJob, type AiChartJob, type AiChartRequest, type AiTechnicalAnalysis } from "@/lib/stockApi";
import type { AiPanelState } from "@/components/youtube/chart/AiAnalysisPanel";

type Operation = "analysis" | "drawings";
export type ChartJobState = AiPanelState & { phase?: "submitting" | "queued" | "running"; errorCode?: string };
const empty = (): Record<Operation, ChartJobState> => ({ analysis: { status: "idle" }, drawings: { status: "idle" } });

export function useChartAiJobs(symbol: string, onComplete: (operation: Operation, result: AiTechnicalAnalysis) => void) {
  const [states, setStates] = useState(empty);
  const [checking, setChecking] = useState(true);
  const [monitorError, setMonitorError] = useState(false);
  const [revision, setRevision] = useState(0);
  const current = useRef(states);
  const completed = useRef(new Set<string>());
  const tracked = useRef(new Set<string>());
  const callback = useRef(onComplete);
  callback.current = onComplete;
  const submitting = useRef(false);
  const submission = useRef<{ signature: string; id: string } | null>(null);
  const attemptedAt = useRef<Partial<Record<Operation, number>>>({});
  const submitController = useRef<AbortController | null>(null);
  const identity = useRef(symbol);
  identity.current = symbol;

  const update = useCallback((operation: Operation, state: ChartJobState) => {
    current.current = { ...current.current, [operation]: state };
    setStates(current.current);
  }, []);

  const apply = useCallback((job: AiChartJob, submitted = false) => {
    if (job.status === "queued" || job.status === "running") {
      tracked.current.add(job.id);
      update(job.operation, { status: "loading", phase: job.status });
    } else if (job.status === "failed") {
      update(job.operation, { status: "error", errorCode: job.error_code || "ai_analysis_failed" });
    } else if ((submitted || tracked.current.has(job.id)) && !completed.current.has(job.id)) {
      if (!job.result?.version_id) {
        update(job.operation, { status: "error", errorCode: "ai_analysis_failed" });
        return;
      }
      completed.current.add(job.id);
      update(job.operation, { status: "done", result: job.result });
      callback.current(job.operation, job.result);
    }
  }, [update]);

  useEffect(() => {
    submitController.current?.abort();
    submitting.current = false;
    submission.current = null;
    attemptedAt.current = {};
    completed.current.clear();
    tracked.current.clear();
    current.current = empty();
    setStates(current.current);
    setChecking(true);
    setMonitorError(false);
    return () => submitController.current?.abort();
  }, [symbol]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    async function poll() {
      if (stopped) return;
      try {
        const result = await getAiChartJobs(symbol, controller.signal);
        if (stopped) return;
        for (const job of result.items) {
          // A successful status poll must not overwrite a submission error with
          // an unrelated, older job's failure.
          if (!submitting.current && (tracked.current.has(job.id) || Date.parse(job.created_at) >= (attemptedAt.current[job.operation] || 0))) apply(job);
        }
        setMonitorError(false);
      } catch {
        if (!stopped) setMonitorError(true);
      } finally {
        if (!stopped) {
          setChecking(false);
          if (submitting.current || Object.values(current.current).some(state => state.status === "loading")) {
            timer = setTimeout(() => void poll(), 3000);
          }
        }
      }
    }
    void poll();
    const resume = () => {
      clearTimeout(timer);
      setRevision(value => value + 1);
    };
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
    };
  }, [symbol, revision, apply]);

  const submit = useCallback(async (body: AiChartRequest) => {
    if (submitting.current || Object.values(current.current).some(state => state.status === "loading")) return;
    submitting.current = true;
    attemptedAt.current[body.operation] = Date.now();
    update(body.operation, { status: "loading", phase: "submitting" });
    const requestSymbol = symbol;
    const signature = JSON.stringify({ symbol, ...body });
    if (submission.current?.signature !== signature) submission.current = { signature, id: crypto.randomUUID() };
    const controller = new AbortController();
    submitController.current = controller;
    try {
      const job = await submitAiChartJob(symbol, body, submission.current.id, controller.signal);
      if (controller.signal.aborted || identity.current !== requestSymbol) return;
      submission.current = null;
      // The server may return another operation already running on this ticker.
      if (job.operation !== body.operation) update(body.operation, { status: "idle" });
      apply(job, true);
    } catch (reason) {
      if (controller.signal.aborted || identity.current !== requestSymbol) return;
      update(body.operation, { status: "error", errorCode: reason instanceof AiAnalysisError ? (reason.status === 401 ? "Unauthorized" : reason.message) : "ai_submission_unknown" });
    } finally {
      if (!controller.signal.aborted && identity.current === requestSymbol) {
        submitting.current = false;
        setRevision(value => value + 1);
      }
    }
  }, [symbol, apply, update]);

  return {
    ...states, checking, monitorError, submit,
    busy: checking || monitorError || states.analysis.status === "loading" || states.drawings.status === "loading",
    refresh: () => setRevision(value => value + 1),
    clear: (operation: Operation) => update(operation, { status: "idle" }),
  };
}
