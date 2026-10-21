"use client";
import { useEffect, useRef, useState } from "react";
import { EMPTY_FEED, receiveNews, revealNews, type FeedResponse } from "@/lib/newsFeed";

export function useNewsTerminal() {
  const [feed, setFeed] = useState(EMPTY_FEED);
  const [meta, setMeta] = useState<Omit<FeedResponse, "articles"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pauseRef = useRef(false);
  pauseRef.current = paused;
  useEffect(() => {
    let active = true;
    let busy = false;
    let controller: AbortController | undefined;
    async function refresh() {
      if (busy) return;
      busy = true;
      controller = new AbortController();
      setLoading(true);
      try {
        const response = await fetch("/api/news", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("News unavailable");
        const data: FeedResponse = await response.json();
        if (!Array.isArray(data.articles)) throw new Error("Invalid feed");
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
    void refresh();
    const poll = () => { if (!document.hidden && !pauseRef.current) void refresh(); };
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
