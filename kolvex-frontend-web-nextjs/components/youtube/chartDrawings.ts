import { useCallback, useEffect, useRef, useState } from "react";

export type DrawingType = "trend" | "ray" | "hline" | "rect" | "fib" | "measure" | "polyline";
export type DrawingTool = "cursor" | Exclude<DrawingType, "polyline">;

/** Anchored to time and price so drawings survive range and interval changes. */
export interface Anchor {
  time: number;
  price: number;
}

export interface Drawing {
  id: string;
  type: DrawingType;
  points: Anchor[];
  color: string;
  label?: string;
  source?: "ai";
}

/** `local`: signed out or sync not set up; `offline`: last sync attempt failed. */
export type SyncStatus = "loading" | "syncing" | "synced" | "local" | "offline";

export const drawingColors = [
  "rgb(41 98 255)",
  "rgb(245 158 11)",
  "rgb(168 85 247)",
  "rgb(var(--foreground))",
];

export const fibLevels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

const SAVE_DELAY_MS = 800;

/** `remoteUpdatedAt` is the server version this cache last matched; `dirty` means unsent edits. */
interface LocalRecord {
  drawings: Drawing[];
  updatedAt: number;
  remoteUpdatedAt: string | null;
  dirty: boolean;
}

interface RemoteRecord {
  drawings: Drawing[];
  updated_at: string | null;
}

const storageKey = (symbol: string) => `kolvex:chart-drawings:${symbol.toUpperCase()}`;

function isDrawing(value: unknown): value is Drawing {
  const item = value as Drawing;
  return (
    Boolean(item) &&
    typeof item.id === "string" &&
    typeof item.type === "string" &&
    typeof item.color === "string" &&
    Array.isArray(item.points) &&
    item.points.every((point) => Number.isFinite(point?.time) && Number.isFinite(point?.price))
  );
}

function readLocal(symbol: string): LocalRecord {
  const empty: LocalRecord = { drawings: [], updatedAt: 0, remoteUpdatedAt: null, dirty: false };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(symbol)) || "null");
    if (Array.isArray(parsed)) {
      const drawings = parsed.filter(isDrawing);
      return { ...empty, drawings, dirty: drawings.length > 0 };
    }
    if (parsed && Array.isArray(parsed.drawings)) {
      return {
        drawings: parsed.drawings.filter(isDrawing),
        updatedAt: Number(parsed.updatedAt) || 0,
        remoteUpdatedAt: typeof parsed.remoteUpdatedAt === "string" ? parsed.remoteUpdatedAt : null,
        dirty: Boolean(parsed.dirty),
      };
    }
  } catch {
    // Corrupt or unavailable storage falls through to an empty record.
  }
  return empty;
}

function writeLocal(symbol: string, record: LocalRecord) {
  try {
    window.localStorage.setItem(storageKey(symbol), JSON.stringify(record));
  } catch {
    // Storage can be full or disabled; drawings then last for the session only.
  }
}

class SyncError extends Error {
  constructor(public status: number) {
    super(`Chart drawing sync failed: ${status}`);
  }
}

async function fetchRemote(symbol: string): Promise<RemoteRecord> {
  const response = await fetch(`/api/chart-drawings/${encodeURIComponent(symbol)}`, { cache: "no-store" });
  if (!response.ok) throw new SyncError(response.status);
  const data = await response.json();
  return { drawings: (data.drawings || []).filter(isDrawing), updated_at: data.updated_at ?? null };
}

async function pushRemote(symbol: string, drawings: Drawing[], keepalive = false): Promise<RemoteRecord> {
  const response = await fetch(`/api/chart-drawings/${encodeURIComponent(symbol)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drawings }),
    keepalive,
  });
  if (!response.ok) throw new SyncError(response.status);
  const data = await response.json();
  return { drawings: (data.drawings || []).filter(isDrawing), updated_at: data.updated_at ?? null };
}

const failureStatus = (error: unknown): SyncStatus =>
  error instanceof SyncError && error.status === 401 ? "local" : "offline";

/**
 * Drawings for one ticker: localStorage first for instant paint, then reconciled with the
 * signed-in user's server copy. The newer side wins; edits are pushed after a short pause.
 */
export function useSyncedDrawings(symbol: string) {
  const [state, setState] = useState<{ symbol: string; drawings: Drawing[] }>({ symbol: "", drawings: [] });
  const [status, setStatus] = useState<SyncStatus>("loading");
  const record = useRef<LocalRecord | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const current = useRef(symbol);
  current.current = symbol;

  const apply = useCallback((target: string, next: LocalRecord) => {
    record.current = next;
    writeLocal(target, next);
    if (current.current === target) setState({ symbol: target, drawings: next.drawings });
  }, []);

  const pushRef = useRef<(target: string) => void>(() => {});
  const schedule = useCallback((target: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      pushRef.current(target);
    }, SAVE_DELAY_MS);
  }, []);

  const push = useCallback(
    async (target: string, keepalive = false) => {
      const pending = record.current;
      if (!pending?.dirty || inFlight.current) return;
      inFlight.current = true;
      if (current.current === target) setStatus("syncing");
      const sent = pending.drawings;
      try {
        const saved = await pushRemote(target, sent, keepalive);
        const latest = current.current === target ? record.current : readLocal(target);
        const changedMeanwhile = latest !== null && latest.drawings !== sent;
        const next: LocalRecord = {
          ...(latest || pending),
          remoteUpdatedAt: saved.updated_at,
          dirty: changedMeanwhile,
        };
        if (current.current === target) {
          record.current = next;
          setStatus("synced");
        }
        writeLocal(target, next);
        if (changedMeanwhile && current.current === target) schedule(target);
      } catch (error) {
        if (current.current === target) setStatus(failureStatus(error));
      } finally {
        inFlight.current = false;
      }
    },
    [schedule],
  );
  pushRef.current = push;

  const pull = useCallback(
    async (target: string) => {
      try {
        const remote = await fetchRemote(target);
        if (current.current !== target) return;
        const local = record.current || readLocal(target);
        const remoteTime = remote.updated_at ? Date.parse(remote.updated_at) : 0;
        if (local.dirty && (!remote.updated_at || local.updatedAt > remoteTime)) {
          await push(target);
          return;
        }
        if (remote.updated_at !== local.remoteUpdatedAt || local.dirty) {
          apply(target, {
            drawings: remote.drawings,
            updatedAt: remoteTime,
            remoteUpdatedAt: remote.updated_at,
            dirty: false,
          });
        }
        setStatus("synced");
      } catch (error) {
        if (current.current === target) setStatus(failureStatus(error));
      }
    },
    [apply, push],
  );

  useEffect(() => {
    const local = readLocal(symbol);
    record.current = local;
    setState({ symbol, drawings: local.drawings });
    setStatus("loading");
    pull(symbol);

    const refresh = () => {
      if (document.visibilityState !== "visible" || timer.current || inFlight.current) return;
      if (record.current?.dirty) push(symbol);
      else pull(symbol);
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        push(symbol, true);
      }
    };
  }, [symbol, pull, push]);

  const setDrawings = useCallback(
    (drawings: Drawing[]) => {
      apply(symbol, {
        drawings,
        updatedAt: Date.now(),
        remoteUpdatedAt: record.current?.remoteUpdatedAt ?? null,
        dirty: true,
      });
      schedule(symbol);
    },
    [apply, schedule, symbol],
  );

  return {
    drawings: state.symbol === symbol ? state.drawings : [],
    setDrawings,
    status,
  };
}

export function newDrawingId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
