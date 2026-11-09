/**
 * Text-level rules shared by every surface that renders model-written Markdown.
 *
 * This module is deliberately free of React and of `"use client"`: the published
 * research pages render Markdown from a server component, and a plain function
 * imported from a client module would arrive there as an unusable client reference.
 */

import { defaultUrlTransform } from "react-markdown";
import type { PluggableList } from "unified";
import remarkGfm from "remark-gfm";
import { remarkStockMentions, symbolFromStockLink } from "./stockMentions";

const EMOJI_CORE = String.raw`(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\uFE0F|\u200D|\u20E3)+`;
const EMOJI = new RegExp(EMOJI_CORE, "gu");
/** A pictograph that opens a line is dropped with the space it took, not the indentation before it. */
const LEADING_EMOJI = new RegExp(String.raw`^([ \t]*)${EMOJI_CORE}[ \t]*`, "u");

/** Drop decorative pictographs and tidy the spacing they leave behind. */
export function stripEmoji(text: string): string {
  if (!text) return text;
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(LEADING_EMOJI, "$1")
        .replace(EMOJI, "")
        // Leading whitespace stays: it is what makes a nested list or a code block a code block.
        .replace(/(\S)[ \t]{2,}/g, "$1 ")
        .replace(/[ \t]+$/, ""),
    )
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export interface ChartSpec {
  type: "bar" | "line";
  title?: string;
  unit?: string;
  items: Array<{ label: string; value: number }>;
}

/** Parse the JSON in a ```chart block; anything malformed renders as the original text. */
export function parseChartSpec(source: string): ChartSpec | null {
  let raw: unknown;
  try {
    raw = JSON.parse(source);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const data = raw as { type?: unknown; title?: unknown; unit?: unknown; items?: unknown };
  const items = Array.isArray(data.items)
    ? data.items
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const { label, value } = item as { label?: unknown; value?: unknown };
          const numeric = typeof value === "number" ? value : Number(value);
          if (!Number.isFinite(numeric)) return null;
          return { label: String(label ?? "").trim() || "—", value: numeric };
        })
        .filter((item): item is { label: string; value: number } => item !== null)
        .slice(0, 24)
    : [];
  if (items.length < 2) return null;
  return {
    type: data.type === "line" ? "line" : "bar",
    title: typeof data.title === "string" ? data.title : undefined,
    unit: typeof data.unit === "string" ? data.unit : undefined,
    items,
  };
}

/**
 * GFM tables plus stock mentions. Plain values, so this also works in a server render.
 * unified calls each entry as an attacher (returning the tree transformer), which is why
 * the plugin is passed as a function rather than called here.
 */
export const RICH_REMARK_PLUGINS: PluggableList = [remarkGfm, [remarkStockMentions, {}]];

/**
 * Plugins seeded with symbols the page already knows (a workspace's tickers), so prose
 * can link them before any table names them.
 */
export function richRemarkPlugins(knownSymbols?: string[]): PluggableList {
  const symbols = (knownSymbols ?? []).filter(Boolean);
  return symbols.length ? [remarkGfm, [remarkStockMentions, { knownSymbols: symbols }]] : RICH_REMARK_PLUGINS;
}

/** Keeps the default URL policy, with one extra scheme: our internal stock links. */
export function richUrlTransform(url: string) {
  return symbolFromStockLink(url) ? url : defaultUrlTransform(url);
}
