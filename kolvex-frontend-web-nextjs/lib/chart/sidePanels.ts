/**
 * Advanced chart side column ("看盘" panels). Pure data + helpers so the stored layout can be
 * validated without a browser. The column stacks the panels in `open` order; each can be
 * collapsed to its header.
 */

export const SIDE_PANEL_IDS = ["watchlist", "ai", "news", "earnings"] as const;
export type SidePanelId = (typeof SIDE_PANEL_IDS)[number];

export interface SidePanelLayout {
  /** Panels shown in the column, top to bottom. Never empty-by-accident: see `parseSidePanelLayout`. */
  open: SidePanelId[];
  /** Panels shown as a header only. Always a subset of `open`. */
  collapsed: SidePanelId[];
}

export const SIDE_PANELS_KEY = "kolvex:advanced-chart-panels";

/** The watchlist leads; AI keeps the place it had before panels existed. */
export const DEFAULT_SIDE_PANELS: SidePanelLayout = { open: ["watchlist", "ai"], collapsed: [] };

const isPanel = (value: unknown): value is SidePanelId =>
  typeof value === "string" && (SIDE_PANEL_IDS as readonly string[]).includes(value);

const unique = (values: unknown): SidePanelId[] =>
  Array.isArray(values) ? [...new Set(values.filter(isPanel))] : [];

/** Anything unreadable falls back to the default; unknown ids are dropped. */
export function parseSidePanelLayout(value: unknown): SidePanelLayout {
  if (!value || typeof value !== "object") return DEFAULT_SIDE_PANELS;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.open)) return DEFAULT_SIDE_PANELS;
  const open = unique(record.open);
  return { open, collapsed: unique(record.collapsed).filter((id) => open.includes(id)) };
}

/** Panels the page can show: AI is absent when the chart has no AI actions. */
export function visibleSidePanels(layout: SidePanelLayout, available: readonly SidePanelId[]) {
  return layout.open.filter((id) => available.includes(id));
}

/** Show a closed panel at the bottom, or close an open one. */
export function toggleSidePanel(layout: SidePanelLayout, id: SidePanelId): SidePanelLayout {
  if (layout.open.includes(id))
    return {
      open: layout.open.filter((item) => item !== id),
      collapsed: layout.collapsed.filter((item) => item !== id),
    };
  return { open: [...layout.open, id], collapsed: layout.collapsed };
}

export function toggleSidePanelCollapsed(
  layout: SidePanelLayout,
  id: SidePanelId,
): SidePanelLayout {
  if (!layout.open.includes(id)) return layout;
  return {
    ...layout,
    collapsed: layout.collapsed.includes(id)
      ? layout.collapsed.filter((item) => item !== id)
      : [...layout.collapsed, id],
  };
}

/** Move an open panel one place up (-1) or down (+1). */
export function moveSidePanel(
  layout: SidePanelLayout,
  id: SidePanelId,
  step: -1 | 1,
): SidePanelLayout {
  const index = layout.open.indexOf(id);
  const target = index + step;
  if (index < 0 || target < 0 || target >= layout.open.length) return layout;
  const open = [...layout.open];
  [open[index], open[target]] = [open[target], open[index]];
  return { ...layout, open };
}

export function readSidePanelLayout(): SidePanelLayout {
  try {
    const raw = window.localStorage.getItem(SIDE_PANELS_KEY);
    return raw ? parseSidePanelLayout(JSON.parse(raw)) : DEFAULT_SIDE_PANELS;
  } catch {
    return DEFAULT_SIDE_PANELS;
  }
}

export function writeSidePanelLayout(layout: SidePanelLayout) {
  try {
    window.localStorage.setItem(SIDE_PANELS_KEY, JSON.stringify(layout));
  } catch {
    // Private windows may block storage; the layout still works for this visit.
  }
}
