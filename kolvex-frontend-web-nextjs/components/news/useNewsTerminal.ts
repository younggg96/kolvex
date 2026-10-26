"use client";
import { loadClientCache, peekClientCache } from "@/lib/clientCache";
import { useEffect, useRef, useState } from "react";
import { EMPTY_FEED, receiveNews, revealNews, type FeedResponse } from "@/lib/newsFeed";

export function useNewsTerminal() {
  const saved = peekClientCache<FeedResponse>("/api/news");
  const [feed, setFeed] = useState(saved ? receiveNews(EMPTY_FEED, saved.articles) : EMPTY_FEED);
  const [meta, setMeta] = useState<Omit<FeedResponse, "articles"> | null>(saved ?? null);
  const [loading, setLoading] = useState(!saved);
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pauseRef = useRef(false);
  pauseRef.current = paused;
  useEffect(() => {
    let active = true;
    let busy = false;
    let controller: AbortController | undefined;
    async function refresh(force = false) {
      if (busy) return;
      busy = true;
      controller = new AbortController();
      setLoading(true);
      try {
        const data = await loadClientCache<FeedResponse>("/api/news", async signal => {
          const response = await fetch("/api/news", { signal, cache: "no-store" });
          if (!response.ok) throw new Error("News unavailable");
          const result: FeedResponse = await response.json();
          if (!Array.isArray(result.articles)) throw new Error("Invalid feed");
          return result;
        }, { ttl: 30_000, maxAge: 5 * 60_000, force, signal: controller.signal });
        if (!active) return;
        setFeed(previous => receiveNews(previous, data.articles));
        const { articles: _, ...metadata } = data;
        setMeta(metadata);
        setError(false);
      } catch {
        if (active) setError(true);
      } finally {
        busy = false;
        if (active) setLoading(false);
      }
    }
    void refresh(attempt > 0);
    const poll = () => { if (!document.hidden && !pauseRef.current) void refresh(true); };
    const timer = setInterval(poll, 60_000);
    document.addEventListener("visibilitychange", poll);
    window.addEventListener("online", poll);
    return () => { active = false; controller?.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", poll); window.removeEventListener("online", poll); };
  }, [attempt]);
  return { feed, meta, loading, error, paused,
    refresh: () => setAttempt(n => n + 1),
    togglePause: () => { setPaused(!paused); if (paused) setAttempt(n => n + 1); },
    reveal: () => setFeed(revealNews),
  };
}
