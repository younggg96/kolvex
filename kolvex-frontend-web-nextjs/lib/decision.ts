import type { YouTubeOpinion } from "./youtubeOpinionsApi";

export type Direction = "bullish" | "neutral" | "bearish";
export interface ThesisDraft {
  ticker: string;
  direction: Direction;
  reasoning: string;
  entry_low: number | null;
  entry_high: number | null;
  invalidation: number | null;
  target: number | null;
  horizon: string;
  status: "active" | "closed";
  review: string;
  evidence: { technical?: Direction | null; creators?: Direction | null };
}
export interface Thesis extends ThesisDraft {
  id: string;
  thesis_id: string;
  version: number;
  created_at: string;
}
export const validTicker = (ticker: string) =>
  /^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker);

/** One latest opinion per creator, in a defined 30-day window; prolific channels don't dominate. */
export function creatorEvidence(opinions: YouTubeOpinion[], now = Date.now()) {
  const latest = new Map<string, YouTubeOpinion>();
  for (const opinion of opinions) {
    const date = Date.parse(opinion.opinion_date);
    if (!Number.isFinite(date) || date > now || date < now - 30 * 86400000)
      continue;
    const previous = latest.get(opinion.channel_id);
    if (!previous || date > Date.parse(previous.opinion_date))
      latest.set(opinion.channel_id, opinion);
  }
  const calls = [...latest.values()];
  const bullish = calls.filter((x) => x.sentiment === "bullish").length;
  const bearish = calls.filter((x) => x.sentiment === "bearish").length;
  const direction: Direction | null = calls.length
    ? bullish > bearish
      ? "bullish"
      : bearish > bullish
        ? "bearish"
        : "neutral"
    : null;
  return {
    direction,
    bullish,
    bearish,
    neutral: calls.length - bullish - bearish,
    count: calls.length,
  };
}

export function thesisChanges(
  thesis: Thesis,
  price: number | null,
  evidence?: ThesisDraft["evidence"],
) {
  const changes: Array<"invalidation" | "target" | "technical" | "creators"> =
    [];
  if (thesis.status !== "active") return changes;
  if (price !== null && price > 0 && thesis.direction !== "neutral") {
    const long = thesis.direction === "bullish";
    if (
      thesis.invalidation !== null &&
      (long ? price <= thesis.invalidation : price >= thesis.invalidation)
    )
      changes.push("invalidation");
    if (
      thesis.target !== null &&
      (long ? price >= thesis.target : price <= thesis.target)
    )
      changes.push("target");
  }
  for (const key of ["technical", "creators"] as const) {
    if (
      evidence?.[key] &&
      thesis.evidence[key] &&
      evidence[key] !== thesis.evidence[key]
    )
      changes.push(key);
  }
  return changes;
}

export function riskReward(
  draft: Pick<
    ThesisDraft,
    "entry_low" | "entry_high" | "target" | "invalidation" | "direction"
  >,
) {
  if (
    draft.direction === "neutral" ||
    draft.entry_low === null ||
    draft.invalidation === null ||
    draft.target === null
  )
    return null;
  const entry = (draft.entry_low + (draft.entry_high ?? draft.entry_low)) / 2;
  const sign = draft.direction === "bullish" ? 1 : -1;
  const risk = (entry - draft.invalidation) * sign;
  const reward = (draft.target - entry) * sign;
  return risk > 0 && reward > 0 ? reward / risk : null;
}

export function validateThesis(value: unknown): ThesisDraft {
  if (!value || typeof value !== "object") throw new Error("Invalid thesis");
  const v = value as Record<string, unknown>;
  if (typeof v.ticker !== "string" || !validTicker(v.ticker))
    throw new Error("Invalid ticker");
  if (!["bullish", "neutral", "bearish"].includes(String(v.direction)))
    throw new Error("Invalid direction");
  if (
    typeof v.reasoning !== "string" ||
    !v.reasoning.trim() ||
    v.reasoning.length > 10000
  )
    throw new Error("A thesis needs a reason (up to 10,000 characters)");
  if (
    typeof v.horizon !== "string" ||
    !v.horizon.trim() ||
    v.horizon.length > 100
  )
    throw new Error("A time horizon is required");
  if (!["active", "closed"].includes(String(v.status)))
    throw new Error("Invalid status");
  if (typeof v.review !== "string" || v.review.length > 10000)
    throw new Error("Invalid review");
  const prices: Record<string, number | null> = {};
  for (const key of ["entry_low", "entry_high", "invalidation", "target"]) {
    const price = v[key];
    if (
      price !== null &&
      (typeof price !== "number" ||
        !Number.isFinite(price) ||
        price <= 0 ||
        price > 1e9)
    )
      throw new Error("Prices must be positive numbers");
    prices[key] = price as number | null;
  }
  if (prices.entry_high !== null && prices.entry_low === null)
    throw new Error("Entry low is required for an entry range");
  if (
    prices.entry_low !== null &&
    prices.entry_high !== null &&
    prices.entry_low > prices.entry_high
  )
    throw new Error("Entry low must not exceed entry high");
  if (v.direction !== "neutral" && prices.entry_low !== null) {
    const low = prices.entry_low;
    const high = prices.entry_high ?? low;
    if (
      prices.invalidation !== null &&
      (v.direction === "bullish"
        ? prices.invalidation >= low
        : prices.invalidation <= high)
    )
      throw new Error(
        "Invalidation must be beyond the entry range in the risk direction",
      );
    if (
      prices.target !== null &&
      (v.direction === "bullish" ? prices.target <= high : prices.target >= low)
    )
      throw new Error(
        "Target must be beyond the entry range in the thesis direction",
      );
  }
  const evidence: ThesisDraft["evidence"] = {};
  const raw = v.evidence as Record<string, unknown> | undefined;
  for (const key of ["technical", "creators"] as const) {
    if (raw?.[key] === null || raw?.[key] === undefined) evidence[key] = null;
    else if (["bullish", "neutral", "bearish"].includes(String(raw[key])))
      evidence[key] = raw[key] as Direction;
    else throw new Error("Invalid evidence");
  }
  return {
    ticker: v.ticker,
    direction: v.direction as Direction,
    reasoning: v.reasoning.trim(),
    ...prices,
    horizon: v.horizon.trim(),
    status: v.status as ThesisDraft["status"],
    review: v.review.trim(),
    evidence,
  } as ThesisDraft;
}

async function request<T>(path = "", options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/theses${path}`, {
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load your theses");
  return data;
}
export const listTheses = (ticker?: string) =>
  request<{ items: Thesis[] }>(
    ticker ? `?ticker=${encodeURIComponent(ticker)}` : "",
  );
export const thesisHistory = (id: string) =>
  request<{ items: Thesis[] }>(`/${id}`);
export const saveThesis = (draft: ThesisDraft, existing?: Thesis) =>
  request<Thesis>(existing ? `/${existing.thesis_id}` : "", {
    method: existing ? "PATCH" : "POST",
    body: JSON.stringify({ ...draft, version: existing?.version }),
  });
