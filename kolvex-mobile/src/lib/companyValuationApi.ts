// Same backend routes the Web reaches through /api/market/valuation and /api/market/valuation-ai.
import { ApiError, apiRequest } from "./http";
import type {
  CompanyAiResult,
  CompanyCommand,
  CompanyInputs,
  CompanyResult,
} from "./companyValuation";

const encoded = encodeURIComponent;
/** Carries the backend's code (detail) and HTTP status for the screen to word. */
export class ValuationError extends Error {
  constructor(
    code: string,
    public status: number,
  ) {
    super(code);
  }
}
const wrap = (error: unknown, fallback: string): never => {
  if (error instanceof ApiError)
    throw new ValuationError(
      error.detail && error.detail !== "Not Found" ? error.detail : fallback,
      error.status,
    );
  throw error;
};

export async function loadCompanyInputs(
  symbol: string,
  signal: AbortSignal,
): Promise<CompanyInputs> {
  try {
    return await apiRequest<CompanyInputs>(
      `/valuation/${encoded(symbol)}/inputs`,
      {
        signal,
        timeout: 45_000,
      },
    );
  } catch (error) {
    return wrap(error, "inputs_unavailable");
  }
}
export async function calculateCompany(
  symbol: string,
  command: CompanyCommand,
  signal: AbortSignal,
): Promise<CompanyResult> {
  try {
    return await apiRequest<CompanyResult>(
      `/valuation/${encoded(symbol)}/calculate`,
      { method: "POST", body: command, signal, timeout: 30_000 },
    );
  } catch (error) {
    return wrap(error, "calculation_unavailable");
  }
}
export async function generateAiAssumptions(
  symbol: string,
  body: {
    snapshot_id: string;
    model: string;
    locale: string;
    regenerate: boolean;
  },
  user: string,
  signal: AbortSignal,
): Promise<CompanyAiResult> {
  try {
    return await apiRequest<CompanyAiResult>(
      `/valuation/${encoded(symbol)}/ai-assumptions`,
      {
        method: "POST",
        body,
        signal,
        authenticated: true,
        expectedUser: user,
        timeout: 160_000,
      },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401)
      throw new ValuationError("Unauthorized", 401);
    return wrap(error, "ai_unavailable");
  }
}
export async function loadAiRuns(
  symbol: string,
  user: string,
  signal: AbortSignal,
): Promise<CompanyAiResult[]> {
  try {
    const data = await apiRequest<{ items?: CompanyAiResult[] }>(
      `/valuation/${encoded(symbol)}/ai-runs`,
      { signal, authenticated: true, expectedUser: user, timeout: 20_000 },
    );
    return data.items ?? [];
  } catch (error) {
    return wrap(error, "ai_runs_unavailable");
  }
}
