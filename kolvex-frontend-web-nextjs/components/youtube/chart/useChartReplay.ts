import { useEffect, useMemo, useState } from "react";
import type { PriceBar } from "@/lib/stockApi";
import type { GraphView, priceDomain } from "@/lib/chart/graph";

import {
  defaultReplayStart,
  replayPosition,
  replayWindow,
  type ReplaySpeed,
} from "@/lib/chart/replay";

type PriceDomain = ReturnType<typeof priceDomain>;

type Replay = {
  key: string;
  bars: PriceBar[];
  position: number;
  choosing: boolean;
  playing: boolean;
  speed: ReplaySpeed;
  view: GraphView;
  windowSpan: number;
  priceDomain: PriceDomain | null;
};

export function useChartReplay(key: string, liveBars: PriceBar[] | null) {
  const [session, setSession] = useState<Replay | null>(null);
  // Render live data immediately on a ticker/timeframe change, before the effect runs.
  const replay = session?.key === key ? session : null;
  useEffect(() => {
    setSession((previous) => (previous?.key === key ? previous : null));
  }, [key]);

  const replaySource = replay?.bars;
  const revealedCount = replay && !replay.choosing ? replay.position + 1 : null;
  const bars = useMemo(() => {
    if (!replaySource) return liveBars;
    return revealedCount === null ? replaySource : replaySource.slice(0, revealedCount);
  }, [replaySource, revealedCount, liveBars]);

  function update(change: (current: Replay) => Replay) {
    setSession((previous) => (previous?.key === key ? change(previous) : previous));
  }

  function open(view: GraphView) {
    if (!liveBars || liveBars.length < 2) return;
    setSession({
      key,
      bars: liveBars,
      position: defaultReplayStart(view, liveBars.length),
      choosing: true,
      playing: false,
      speed: 1,
      view,
      windowSpan: view.end - view.start,
      priceDomain: null,
    });
  }

  function start(index: number) {
    update((current) => {
      const position = replayPosition(index, current.bars.length);
      return {
        ...current,
        position,
        choosing: false,
        playing: false,
        view: replayWindow(current.windowSpan, position),
        priceDomain: null,
      };
    });
  }

  function seek(index: number) {
    update((current) => {
      if (current.choosing)
        return { ...current, position: replayPosition(index, current.bars.length) };
      const position = replayPosition(index, current.bars.length);
      return {
        ...current,
        position,
        view: replayWindow(current.windowSpan, position),
        playing: false,
      };
    });
  }

  const playing = replay?.playing ?? false;
  const speed = replay?.speed ?? 1;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setSession((current) => {
        if (!current?.playing || current.key !== key) return current;
        const position = current.position + 1;
        return {
          ...current,
          position,
          view: replayWindow(current.windowSpan, position),
          playing: position < current.bars.length - 1,
        };
      });
    }, 1_000 / speed);
    return () => window.clearInterval(timer);
  }, [key, playing, speed]);

  return {
    replay,
    bars,
    open,
    close: () => setSession(null),
    start,
    seek,
    toggle: () =>
      update((current) => ({
        ...current,
        playing: !current.playing && current.position < current.bars.length - 1,
      })),
    setSpeed: (speed: ReplaySpeed) => update((current) => ({ ...current, speed })),
    setView: (view: GraphView) =>
      update((current) => ({
        ...current,
        view,
        windowSpan: view.end - view.start,
      })),
    setPriceDomain: (priceDomain: PriceDomain | null) =>
      update((current) => ({ ...current, priceDomain })),
  };
}
