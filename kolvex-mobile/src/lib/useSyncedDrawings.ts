// The Web's useSyncedDrawings (components/youtube/chartDrawings.ts) for the app: drawings for one
// ticker paint from the device cache first, then reconcile with the account's server copy.
// The newer side wins, and edits are pushed after a short pause.
import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "./http";
import type { Drawing } from "./technicalTypes";

export type SyncStatus = "loading" | "syncing" | "synced" | "local" | "offline";
export const syncLabels: Record<SyncStatus, string> = {
  loading: "正在加载画线…",
  syncing: "正在同步画线…",
  synced: "画线已同步到你的账户",
  local: "画线仅保存在本设备（登录后可跨设备同步）",
  offline: "画线同步失败，已保存在本设备，稍后会自动重试",
};

const SAVE_DELAY_MS = 800;
const HISTORY_LIMIT = 50;

interface LocalRecord {
  drawings: Drawing[];
  updatedAt: number;
  remoteUpdatedAt: string | null;
  dirty: boolean;
}

const storageKey = (symbol: string) =>
  `kolvex:chart-drawings:${symbol.toUpperCase()}`;

/** Earlier app builds stored seconds; the Web and the server use milliseconds. */
function normalize(drawing: Drawing): Drawing {
  return drawing.points.some((p) => p.time < 1e11)
    ? {
        ...drawing,
        points: drawing.points.map((p) =>
          p.time < 1e11 ? { ...p, time: p.time * 1000 } : p,
        ),
      }
    : drawing;
}

function isDrawing(value: unknown): value is Drawing {
  const item = value as Drawing;
  return (
    !!item &&
    typeof item.id === "string" &&
    typeof item.type === "string" &&
    typeof item.color === "string" &&
    Array.isArray(item.points) &&
    item.points.every(
      (p) => Number.isFinite(p?.time) && Number.isFinite(p?.price),
    )
  );
}
const clean = (list: unknown) =>
  Array.isArray(list) ? list.filter(isDrawing).map(normalize) : [];

async function readLocal(symbol: string): Promise<LocalRecord> {
  const empty: LocalRecord = {
    drawings: [],
    updatedAt: 0,
    remoteUpdatedAt: null,
    dirty: false,
  };
  try {
    const parsed = JSON.parse(
      (await AsyncStorage.getItem(storageKey(symbol))) || "null",
    );
    if (parsed && Array.isArray(parsed.drawings))
      return {
        drawings: clean(parsed.drawings),
        updatedAt: Number(parsed.updatedAt) || 0,
        remoteUpdatedAt:
          typeof parsed.remoteUpdatedAt === "string"
            ? parsed.remoteUpdatedAt
            : null,
        dirty: !!parsed.dirty,
      };
  } catch {
    // Corrupt or unavailable storage falls through to an empty record.
  }
  return empty;
}
function writeLocal(symbol: string, record: LocalRecord) {
  void AsyncStorage.setItem(storageKey(symbol), JSON.stringify(record)).catch(
    () => {},
  );
}

type Remote = { drawings: Drawing[]; updated_at: string | null };

export function useSyncedDrawings(symbol: string, user: string | undefined) {
  const [drawings, setState] = useState<Drawing[]>([]);
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [history, setHistory] = useState<Drawing[][]>([]);
  const record = useRef<LocalRecord | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const alive = useRef(true);

  const apply = useCallback(
    (next: LocalRecord) => {
      record.current = next;
      writeLocal(symbol, next);
      if (alive.current) setState(next.drawings);
    },
    [symbol],
  );

  const pushRef = useRef<() => Promise<void>>(async () => {});
  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void pushRef.current();
    }, SAVE_DELAY_MS);
  }, []);

  const push = useCallback(async () => {
    const pending = record.current;
    if (!pending?.dirty || inFlight.current) return;
    if (!user) {
      setStatus("local");
      return;
    }
    inFlight.current = true;
    setStatus("syncing");
    const sent = pending.drawings;
    try {
      const saved = await apiRequest<Remote>(
        `/chart-drawings/${encodeURIComponent(symbol)}`,
        {
          method: "PUT",
          body: { drawings: sent },
          authenticated: true,
          expectedUser: user,
        },
      );
      const latest = record.current ?? pending;
      const changed = latest.drawings !== sent;
      const next = {
        ...latest,
        remoteUpdatedAt: saved.updated_at ?? null,
        dirty: changed,
      };
      record.current = next;
      writeLocal(symbol, next);
      if (alive.current) setStatus("synced");
      if (changed) schedule();
    } catch (error) {
      if (alive.current)
        setStatus(
          (error as { status?: number }).status === 401 ? "local" : "offline",
        );
    } finally {
      inFlight.current = false;
    }
  }, [symbol, user, schedule]);
  useEffect(() => {
    pushRef.current = push;
  }, [push]);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    void (async () => {
      const local = await readLocal(symbol);
      if (cancelled) return;
      apply(local);
      if (!user) {
        setStatus("local");
        return;
      }
      try {
        const remote = await apiRequest<Remote>(
          `/chart-drawings/${encodeURIComponent(symbol)}`,
          { authenticated: true, expectedUser: user },
        );
        if (cancelled) return;
        const current = record.current ?? local;
        const remoteTime = remote.updated_at
          ? Date.parse(remote.updated_at)
          : 0;
        if (
          current.dirty &&
          (!remote.updated_at || current.updatedAt > remoteTime)
        ) {
          await pushRef.current();
          return;
        }
        apply({
          drawings: clean(remote.drawings),
          updatedAt: remoteTime,
          remoteUpdatedAt: remote.updated_at ?? null,
          dirty: false,
        });
        setStatus("synced");
      } catch (error) {
        if (!cancelled)
          setStatus(
            (error as { status?: number }).status === 401 ? "local" : "offline",
          );
      }
    })();
    return () => {
      cancelled = true;
      alive.current = false;
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        void pushRef.current();
      }
    };
  }, [symbol, user, apply]);

  /** `recordFrom` adds an undo step (null skips it, e.g. mid-drag). */
  const setDrawings = useCallback(
    (next: Drawing[], recordFrom?: Drawing[] | null) => {
      const before =
        recordFrom === undefined ? record.current?.drawings : recordFrom;
      if (before) setHistory((h) => [...h.slice(-HISTORY_LIMIT + 1), before]);
      apply({
        drawings: next,
        updatedAt: Date.now(),
        remoteUpdatedAt: record.current?.remoteUpdatedAt ?? null,
        dirty: true,
      });
      schedule();
    },
    [apply, schedule],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      const previous = h.at(-1);
      if (!previous) return h;
      apply({
        drawings: previous,
        updatedAt: Date.now(),
        remoteUpdatedAt: record.current?.remoteUpdatedAt ?? null,
        dirty: true,
      });
      schedule();
      return h.slice(0, -1);
    });
  }, [apply, schedule]);

  return { drawings, setDrawings, undo, canUndo: history.length > 0, status };
}
