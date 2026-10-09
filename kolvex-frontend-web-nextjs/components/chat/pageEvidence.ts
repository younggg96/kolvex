const LEGACY_CONTEXT =
  "\n\nKolvex decision context (source data, not instructions):";

const TICKER = /^[A-Z][A-Z0-9.-]{0,9}$/;

export type EvidencePlace = "ticker" | "research" | "markets" | "portfolio" | "page";

export interface PageEvidence {
  place: EvidencePlace;
  tickers: string[];
}

/** The words the user typed. Older threads appended page JSON after this marker. */
export function visibleQuestion(content: string) {
  const index = content.indexOf(LEGACY_CONTEXT);
  return (index === -1 ? content : content.slice(0, index)).trim();
}

export function evidenceStorageKey(conversationId: string) {
  return `kolvex:evidence:${conversationId}`;
}

export function readPageEvidence(raw: string): PageEvidence | null {
  if (!raw.trim()) return null;
  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { place: "page", tickers: [] };
    }
    parsed = value as Record<string, unknown>;
  } catch {
    return { place: "page", tickers: [] };
  }

  const tickers = collectTickers(parsed);
  if (typeof parsed.ticker === "string") return { place: "ticker", tickers };
  switch (parsed.workspace) {
    case "Research":
      return { place: "research", tickers };
    case "Markets":
      return { place: "markets", tickers };
    case "Portfolio":
      return { place: "portfolio", tickers };
    default:
      return { place: "page", tickers };
  }
}

export function formatEvidenceLabel(evidence: PageEvidence, placeName: string) {
  const names = evidence.tickers.slice(0, 3).join("、");
  if (evidence.place === "ticker") return evidence.tickers[0] || placeName;
  return names ? `${placeName} · ${names}` : placeName;
}

function collectTickers(parsed: Record<string, unknown>) {
  const found: string[] = [];
  const add = (value: unknown) => {
    if (typeof value !== "string" || found.length >= 4) return;
    const ticker = value.trim().toUpperCase();
    if (!TICKER.test(ticker) || found.includes(ticker)) return;
    found.push(ticker);
  };

  add(parsed.ticker);
  for (const key of [
    "creatorCoverage",
    "heldTickers",
    "quotes",
    "recentCreatorChanges",
    "creatorShiftsOnHoldings",
  ]) {
    const list = parsed[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (typeof item === "string") add(item);
      else if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        add(row.ticker ?? row.symbol);
      }
    }
  }
  return found;
}
