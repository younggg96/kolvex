import { GRAPH_MIN_BARS, type GraphView } from "./graph";

export const REPLAY_SPEEDS = [1, 2, 4] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

/** Pick a starting point inside the visible window, with at least one bar left to play. */
export function defaultReplayStart(view: GraphView, count: number) {
  const first = Math.max(Math.floor(view.start), 0);
  const last = Math.min(Math.ceil(view.end) - 1, count - 1);
  return Math.max(0, Math.min(Math.floor((first + last) / 2), count - 2));
}

export function replayPosition(index: number, count: number) {
  return Math.min(Math.max(Math.trunc(index), 0), count - 1);
}

/** Preserve the zoom and keep the newest revealed bar visible after a seek or step. */
export function replayWindow(span: number, position: number) {
  const count = position + 1;
  return { start: count - Math.min(Math.max(span, GRAPH_MIN_BARS), count), end: count };
}
