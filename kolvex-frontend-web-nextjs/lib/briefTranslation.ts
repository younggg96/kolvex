import type { DailyBrief } from "./dailyBriefs";

export type BriefLanguage = "zh" | "en";
// Only editorial copy is translated. IDs, links, tickers, timestamps and financial
// values must survive byte-for-byte, including unknown future schema fields.
const COPY_FIELDS = new Set([
  "title", "headline", "subtitle", "narrative", "paragraphs", "name", "note",
  "detail", "summary", "kicker", "label", "caption", "short_term", "long_term",
  "price_range", "positioning", "checklist", "takeaway", "strategy_line",
  "date_label", "disclaimer",
]);

export function briefSourceLanguage(document: DailyBrief): BriefLanguage {
  const copy = `${document.brief.title} ${document.brief.headline} ${document.brief.subtitle}`;
  return /[\u3400-\u9fff]/u.test(copy) ? "zh" : "en";
}

function mapCopy(value: unknown, transform: (text: string) => string, field = ""): unknown {
  if (typeof value === "string") return COPY_FIELDS.has(field) && value.trim() ? transform(value) : value;
  if (Array.isArray(value)) return value.map(item => mapCopy(item, transform, field));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
      // Source attribution and all URL-bearing metadata stay in their source form.
      key === "sources" ? item : mapCopy(item, transform, key),
    ]));
  }
  return value;
}

export async function translateBrief(
  document: DailyBrief,
  language: BriefLanguage,
  translate: (text: string, language: string, signal?: AbortSignal) => Promise<string>,
  signal: AbortSignal,
  cache = new Map<string, string>(),
): Promise<DailyBrief> {
  const texts = new Set<string>();
  mapCopy(document, text => { texts.add(text); return text; });
  const key = (text: string) => JSON.stringify([language, text]);
  const work = [...texts].filter(text => !cache.has(key(text)));
  let cursor = 0;
  async function worker() {
    while (cursor < work.length) {
      signal.throwIfAborted();
      const text = work[cursor++];
      const result = await translate(text, language, signal);
      signal.throwIfAborted();
      if (!result.trim()) throw new Error("Empty brief translation");
      cache.set(key(text), result);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, work.length) }, worker));
  signal.throwIfAborted();
  return mapCopy(document, text => cache.get(key(text)) ?? text) as DailyBrief;
}
