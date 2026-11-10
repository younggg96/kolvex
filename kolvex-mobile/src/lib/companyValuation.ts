// Pure logic copied from the Web's lib/companyValuation.ts; requests live in companyValuationApi.ts.
export const companyScenarios = ["conservative", "base", "optimistic"] as const;
export type CompanyScenario = (typeof companyScenarios)[number];
export type CompanyModel = "dcf" | "pe" | "peg";
export type CompanyInput =
  "revenue" | "eps" | "shares" | "cash" | "debt" | "other_claims" | "tax_rate";
export const inputScale: Record<CompanyInput, number> = {
  revenue: 1e9,
  eps: 1,
  shares: 1e6,
  cash: 1e9,
  debt: 1e9,
  other_claims: 1e9,
  tax_rate: 0.01,
};
export interface CompanyInputs {
  status: "available" | "unsupported";
  reason?: string;
  symbol: string;
  name: string;
  snapshot_id: string;
  currency: string;
  source: string;
  fetched_at: string;
  inputs: Record<CompanyInput, number | null>;
  origins: Record<string, string>;
  income_basis: string;
  income_periods: string[];
  balance_period: string | null;
  operating_margin: number | null;
  price: number | null;
  quote_time: string | null;
  market_cap_reference: number | null;
  dcf_exclusion: string | null;
  sources: { financials: string; balance_sheet: string };
}
export interface CompanyDraft {
  inputs: Record<CompanyInput, string>;
  edited: CompanyInput[];
  scenarios: Record<CompanyScenario, Record<string, string>>;
  years: string;
  terminal_growth: string;
  terminal_roic: string;
}
export interface CompanyCommand {
  snapshot_id: string;
  model: CompanyModel;
  inputs: Partial<Record<CompanyInput, number>>;
  scenarios: Record<CompanyScenario, Record<string, number>>;
  years: number;
  terminal_growth: number;
  terminal_roic: number;
}
export interface CompanyScenarioResult {
  status: string;
  reason?: string;
  fair_price: number | null;
  equity_value: number | null;
  enterprise_value: number | null;
  target_pe?: number;
  terminal_value_share?: number | null;
  comparison: { price_space: number; premium_discount: number } | null;
  forecast?: {
    year: number;
    revenue: number;
    operating_margin?: number;
    nopat: number;
    reinvestment: number;
    fcff: number;
    present_value: number;
  }[];
}
export interface CompanyResult {
  status: string;
  reason?: string;
  model: CompanyModel;
  snapshot_id: string;
  inputs: Record<CompanyInput, number>;
  scenarios: Record<CompanyScenario, CompanyScenarioResult>;
  sensitivity: {
    discount_rate: number;
    terminal_growth: number;
    fair_price: number | null;
  }[];
}

export function initialCompanyDraft(data: CompanyInputs): CompanyDraft {
  const inputs = Object.fromEntries(
    (Object.keys(inputScale) as CompanyInput[]).map((key) => [
      key,
      data.inputs[key] == null
        ? ""
        : String(Number((data.inputs[key]! / inputScale[key]).toFixed(6))),
    ]),
  ) as Record<CompanyInput, string>;
  const margin =
    data.operating_margin == null
      ? ""
      : String(Number((data.operating_margin * 100).toFixed(4)));
  return {
    inputs,
    edited: [],
    years: "5",
    terminal_growth: "2",
    terminal_roic: "10",
    scenarios: {
      conservative: {
        revenue_growth: "0",
        starting_margin: margin,
        operating_margin: margin,
        reinvestment_rate: "0",
        discount_rate: "12",
        target_pe: "",
        target_peg: ".75",
        eps_growth: "",
      },
      base: {
        revenue_growth: "0",
        starting_margin: margin,
        operating_margin: margin,
        reinvestment_rate: "0",
        discount_rate: "10",
        target_pe: "",
        target_peg: "1",
        eps_growth: "",
      },
      optimistic: {
        revenue_growth: "0",
        starting_margin: margin,
        operating_margin: margin,
        reinvestment_rate: "0",
        discount_rate: "8",
        target_pe: "",
        target_peg: "1.25",
        eps_growth: "",
      },
    },
  };
}

export function buildCompanyCommand(
  data: CompanyInputs,
  model: CompanyModel,
  draft: CompanyDraft,
): CompanyCommand {
  const read = (raw: string, min: number, max: number, exclusive = false) => {
    if (!raw.trim()) throw new Error("required");
    const value = Number(raw);
    if (
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (exclusive && value === min)
    )
      throw new Error("range");
    return value;
  };
  const inputs: CompanyCommand["inputs"] = {};
  const needed: CompanyInput[] =
    model === "dcf"
      ? ["revenue", "shares", "cash", "debt", "other_claims", "tax_rate"]
      : ["eps", "shares"];
  for (const key of needed) {
    // Preserve vendor precision unless the user explicitly edits a field.
    const value = draft.edited.includes(key)
      ? read(
          draft.inputs[key],
          key === "eps" ? -1e12 : 0,
          key === "tax_rate" ? 100 : 1e15,
          ["revenue", "shares"].includes(key),
        ) * inputScale[key]
      : data.inputs[key];
    if (value == null || !Number.isFinite(value)) throw new Error("required");
    if (draft.edited.includes(key)) inputs[key] = value;
  }
  const scenarios = {} as CompanyCommand["scenarios"];
  for (const name of companyScenarios) {
    const v = draft.scenarios[name];
    scenarios[name] =
      model === "dcf"
        ? {
            revenue_growth: read(v.revenue_growth, -100, 200, true) / 100,
            starting_margin: read(v.starting_margin, -1000, 100) / 100,
            operating_margin: read(v.operating_margin, -100, 100) / 100,
            reinvestment_rate: read(v.reinvestment_rate, 0, 200) / 100,
            discount_rate: read(v.discount_rate, 0, 100, true) / 100,
          }
        : model === "pe"
          ? { target_pe: read(v.target_pe, 0, 500, true) }
          : {
              target_peg: read(v.target_peg, 0, 10, true),
              eps_growth: read(v.eps_growth, 0, 200, true) / 100,
            };
  }
  const terminal_growth =
    model === "dcf" ? read(draft.terminal_growth, 0, 5) / 100 : 0.02;
  const terminal_roic =
    model === "dcf" ? read(draft.terminal_roic, 0, 100, true) / 100 : 0.1;
  if (
    model === "dcf" &&
    (companyScenarios.some(
      (k) => scenarios[k].discount_rate <= terminal_growth,
    ) ||
      terminal_roic <= terminal_growth)
  )
    throw new Error("terminal");
  return {
    snapshot_id: data.snapshot_id,
    model,
    inputs,
    scenarios,
    years: draft.years === "10" ? 10 : 5,
    terminal_growth,
    terminal_roic,
  };
}

export interface CompanyAiResult {
  status: string;
  symbol: string;
  snapshot_id: string;
  model_id: string;
  generated_at: string;
  cached?: boolean;
  run_id: string | null;
  saved: boolean;
  price_at_generation: number | null;
  results: Partial<
    Record<
      CompanyModel,
      Record<CompanyScenario, { status: string; fair_price: number | null }>
    >
  >;
  primary_model: CompanyModel;
  summary: string;
  used_consensus: boolean;
  risks: string[];
  rationale: { assumption: string; reason: string }[];
  assumptions: Partial<
    Record<
      CompanyModel,
      {
        scenarios: Record<CompanyScenario, Record<string, number>>;
        years: number;
        terminal_growth: number;
        terminal_roic: number;
      }
    >
  >;
}

const percentText = (value: number) => String(Number((value * 100).toFixed(4)));

/** AI values become ordinary draft fields: the calculator computes them and the user can edit them. */
export function applyAiAssumptions(
  draft: CompanyDraft,
  ai: CompanyAiResult,
): CompanyDraft {
  const scenarios = { ...draft.scenarios };
  for (const name of companyScenarios) {
    const next = { ...scenarios[name] };
    const dcf = ai.assumptions.dcf?.scenarios[name];
    if (dcf)
      for (const key of [
        "revenue_growth",
        "starting_margin",
        "operating_margin",
        "reinvestment_rate",
        "discount_rate",
      ])
        next[key] = percentText(dcf[key]);
    const pe = ai.assumptions.pe?.scenarios[name];
    if (pe) next.target_pe = String(Number(pe.target_pe.toFixed(4)));
    const peg = ai.assumptions.peg?.scenarios[name];
    if (peg) {
      next.target_peg = String(Number(peg.target_peg.toFixed(4)));
      next.eps_growth = percentText(peg.eps_growth);
    }
    scenarios[name] = next;
  }
  const dcf = ai.assumptions.dcf;
  return {
    ...draft,
    scenarios,
    ...(dcf
      ? {
          years: String(dcf.years),
          terminal_growth: percentText(dcf.terminal_growth),
          terminal_roic: percentText(dcf.terminal_roic),
        }
      : {}),
  };
}
