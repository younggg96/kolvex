/**
 * Manual portfolio import: the prompt users hand to an external assistant
 * (Codex, Muse, …) and the parser that checks what it returns before upload.
 * Rules here mirror kolvex-backend-py/app/services/portfolio/manual_import.py.
 */

export const MANUAL_IMPORT_FORMAT_VERSION = 1;
export const MAX_IMPORT_ACCOUNTS = 20;
export const MAX_IMPORT_POSITIONS = 1000;

export interface ManualImportPosition {
  symbol: string;
  name?: string;
  type: "equity" | "option";
  quantity: number;
  average_cost?: number;
  price?: number;
  currency: string;
  underlying?: string;
  option_type?: "call" | "put";
  strike?: number;
  expiration?: string;
}

export interface ManualImportAccount {
  name: string;
  brokerage?: string;
  positions: ManualImportPosition[];
}

export interface ManualImportPayload {
  as_of?: string;
  accounts: ManualImportAccount[];
}

export type ManualImportIssueCode =
  | "empty"
  | "invalidJson"
  | "noAccounts"
  | "tooManyAccounts"
  | "tooManyPositions"
  | "accountName"
  | "duplicateAccount"
  | "noPositions"
  | "symbol"
  | "quantity"
  | "number"
  | "optionFields"
  | "duplicatePosition";

export interface ManualImportIssue {
  code: ManualImportIssueCode;
  account?: string;
  symbol?: string;
  field?: string;
}

export type ManualImportParseResult =
  | { ok: true; payload: ManualImportPayload; notes: string[] }
  | { ok: false; issues: ManualImportIssue[] };

const EQUITY_SYMBOL = /^[A-Z0-9][A-Z0-9.\-/]{0,15}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Pull the JSON object out of a reply that may include code fences or prose. */
export function extractJsonText(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

function toNumber(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[,$\s]/g, "");
    const parsed = Number(cleaned);
    return cleaned && Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Same contract symbol the backend stores, so duplicates are caught before upload. */
export function optionContractSymbol(
  underlying: string,
  expiration: string,
  optionType: "call" | "put",
  strike: number,
): string {
  const [year, month, day] = expiration.split("-");
  const strikeCode = String(Math.round(strike * 1000)).padStart(8, "0");
  return `${underlying}${year.slice(2)}${month}${day}${optionType === "call" ? "C" : "P"}${strikeCode}`;
}

function parsePosition(
  raw: unknown,
  account: string,
  issues: ManualImportIssue[],
): ManualImportPosition | null {
  if (!raw || typeof raw !== "object") {
    issues.push({ code: "symbol", account });
    return null;
  }
  const row = raw as Record<string, unknown>;
  const symbol = (text(row.symbol) || "").toUpperCase();
  const type = text(row.type)?.toLowerCase() === "option" ? "option" : "equity";
  const before = issues.length;

  if (!symbol || (type === "equity" && !EQUITY_SYMBOL.test(symbol))) {
    issues.push({ code: "symbol", account, symbol: symbol || undefined });
  }
  const quantity = toNumber(row.quantity);
  if (quantity === undefined || quantity === null || quantity === 0) {
    issues.push({ code: "quantity", account, symbol });
  }
  const averageCost = toNumber(row.average_cost);
  if (averageCost === null || (averageCost !== undefined && averageCost < 0)) {
    issues.push({ code: "number", account, symbol, field: "average_cost" });
  }
  const price = toNumber(row.price);
  if (price === null || (price !== undefined && price <= 0)) {
    issues.push({ code: "number", account, symbol, field: "price" });
  }

  const position: ManualImportPosition = {
    symbol,
    type,
    quantity: quantity ?? 0,
    currency: (text(row.currency) || "USD").toUpperCase(),
  };
  const name = text(row.name);
  if (name) position.name = name;
  if (typeof averageCost === "number") position.average_cost = averageCost;
  if (typeof price === "number") position.price = price;

  if (type === "option") {
    const underlying = text(row.underlying)?.toUpperCase();
    const optionRaw = text(row.option_type)?.toLowerCase();
    const optionType =
      optionRaw === "call" || optionRaw === "c"
        ? "call"
        : optionRaw === "put" || optionRaw === "p"
          ? "put"
          : undefined;
    const strike = toNumber(row.strike);
    const expiration = text(row.expiration);
    if (
      !underlying ||
      !optionType ||
      typeof strike !== "number" ||
      strike <= 0 ||
      !expiration ||
      !ISO_DATE.test(expiration)
    ) {
      issues.push({ code: "optionFields", account, symbol });
    } else {
      Object.assign(position, { underlying, option_type: optionType, strike, expiration });
    }
  }
  return issues.length === before ? position : null;
}

export function parseManualImport(input: string): ManualImportParseResult {
  if (!input.trim()) return { ok: false, issues: [{ code: "empty" }] };

  let data: unknown;
  try {
    data = JSON.parse(extractJsonText(input));
  } catch {
    return { ok: false, issues: [{ code: "invalidJson" }] };
  }
  const root = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const rawAccounts = Array.isArray(root.accounts) ? root.accounts : [];
  if (rawAccounts.length === 0) return { ok: false, issues: [{ code: "noAccounts" }] };
  if (rawAccounts.length > MAX_IMPORT_ACCOUNTS) {
    return { ok: false, issues: [{ code: "tooManyAccounts" }] };
  }

  const issues: ManualImportIssue[] = [];
  const accounts: ManualImportAccount[] = [];
  const accountNames = new Set<string>();
  let total = 0;

  rawAccounts.forEach((rawAccount, index) => {
    const row = (rawAccount && typeof rawAccount === "object" ? rawAccount : {}) as Record<
      string,
      unknown
    >;
    const name = text(row.name);
    const label = name || `#${index + 1}`;
    if (!name) issues.push({ code: "accountName", account: label });
    else if (accountNames.has(name.toLowerCase())) {
      issues.push({ code: "duplicateAccount", account: name });
    } else accountNames.add(name.toLowerCase());

    const rawPositions = Array.isArray(row.positions) ? row.positions : [];
    if (rawPositions.length === 0) issues.push({ code: "noPositions", account: label });
    total += rawPositions.length;

    const positions: ManualImportPosition[] = [];
    const seen = new Set<string>();
    for (const rawPosition of rawPositions) {
      const position = parsePosition(rawPosition, label, issues);
      if (!position) continue;
      const key =
        position.type === "option"
          ? `O:${optionContractSymbol(position.underlying!, position.expiration!, position.option_type!, position.strike!)}`
          : `E:${position.symbol}`;
      if (seen.has(key)) {
        issues.push({ code: "duplicatePosition", account: label, symbol: position.symbol });
        continue;
      }
      seen.add(key);
      positions.push(position);
    }
    const account: ManualImportAccount = { name: name || label, positions };
    const brokerage = text(row.brokerage);
    if (brokerage) account.brokerage = brokerage;
    accounts.push(account);
  });

  if (total > MAX_IMPORT_POSITIONS) issues.push({ code: "tooManyPositions" });
  if (issues.length > 0) return { ok: false, issues };

  const payload: ManualImportPayload = { accounts };
  const asOf = text(root.as_of);
  if (asOf && ISO_DATE.test(asOf)) payload.as_of = asOf;
  const notes = Array.isArray(root.notes)
    ? root.notes.filter((note): note is string => typeof note === "string" && !!note.trim())
    : [];
  return { ok: true, payload, notes };
}

const EXAMPLE = `{
  "kolvex_portfolio_import": ${MANUAL_IMPORT_FORMAT_VERSION},
  "as_of": "2026-11-18",
  "accounts": [
    {
      "name": "Schwab Individual",
      "brokerage": "Charles Schwab",
      "positions": [
        { "symbol": "NVDA", "name": "NVIDIA Corp", "quantity": 120, "average_cost": 98.5, "price": 145.2, "currency": "USD" },
        { "symbol": "BRK.B", "quantity": 10, "average_cost": 410 },
        { "symbol": "AAPL 250C 2027-01-15", "type": "option", "underlying": "AAPL", "option_type": "call", "strike": 250, "expiration": "2027-01-15", "quantity": 2, "average_cost": 12.3, "price": 14.1 }
      ]
    }
  ],
  "notes": []
}`;

const PROMPT_ZH = `你是我的持仓整理助手。我会接着发给你券商的持仓截图、CSV 导出或复制的文字。请把它们整理成 Kolvex 可以导入的 JSON。

输出要求：
1. 只输出一个 \`\`\`json 代码块，代码块外不要写任何文字。
2. 严格使用下面的结构和字段名：

${EXAMPLE}

字段规则：
- accounts：每个券商账户一项。name 必填且互不重复（例如「Schwab 个人账户」「富途 IRA」）；brokerage 写券商名称。
- symbol：美股代码，大写；带类别的股票用点号，例如 BRK.B。
- quantity：持股数量；期权写合约张数。空头仓位用负数。
- average_cost：每股平均成本；期权写每股权利金（不是每张合约的总价）。
- price：资料里能看到的最新价格（期权同样写每股价格）。看不到就不要写这个字段，Kolvex 会自动取实时报价，千万不要估算。
- currency：三位货币代码，默认 USD。
- 期权必须带 type: "option"、underlying、option_type（call / put）、strike、expiration（YYYY-MM-DD）。
- as_of：资料上的持仓日期（YYYY-MM-DD），看不到就省略。

数据规则：
- 只使用资料里实际出现的数字，不要编造、补全或推算任何持仓、数量、成本或价格。
- 同一账户里同一只股票分多笔买入时，合并成一行：数量相加，average_cost 用加权平均。
- 不要包含现金、货币基金余额或保证金负债。
- 看不清或无法确定的行不要输出，在 notes 数组里用一句话说明跳过了什么、为什么。

每次导入都会整体替换上一次手动导入的持仓，所以请输出完整的当前持仓。`;

const PROMPT_EN = `You are my portfolio formatter. Next I will send you broker holdings screenshots, CSV exports or pasted text. Turn them into JSON that Kolvex can import.

Output:
1. Reply with a single \`\`\`json code block and nothing outside it.
2. Use exactly this structure and these field names:

${EXAMPLE}

Field rules:
- accounts: one entry per brokerage account. name is required and must be unique (e.g. "Schwab Individual", "Fidelity IRA"); brokerage is the broker's name.
- symbol: US ticker in upper case; share classes use a dot, e.g. BRK.B.
- quantity: number of shares; for options, number of contracts. Short positions are negative.
- average_cost: average cost per share; for options, premium per share (not per contract).
- price: latest price shown in the source (per share for options too). If no price is shown, omit the field — Kolvex fetches a live quote. Never estimate it.
- currency: three-letter currency code, default USD.
- Options must include type: "option", underlying, option_type (call / put), strike and expiration (YYYY-MM-DD).
- as_of: the holdings date shown in the source (YYYY-MM-DD); omit it if not shown.

Data rules:
- Only use numbers that actually appear in the source. Do not invent, fill in or infer any position, quantity, cost or price.
- If one account bought the same ticker in several lots, merge them into one row: add the quantities and use the weighted average cost.
- Do not include cash, money-market sweep balances or margin debt.
- Leave out any row you cannot read with confidence, and add one sentence to the notes array saying what you skipped and why.

Each import replaces the previous manual import, so output the complete current holdings.`;

export function buildManualImportPrompt(locale: string): string {
  return locale.toLowerCase().startsWith("zh") ? PROMPT_ZH : PROMPT_EN;
}

export interface ManualImportSummary {
  accounts: number;
  positions: number;
  options: number;
  withoutPrice: number;
  symbols: string[];
}

export function summarizeManualImport(payload: ManualImportPayload): ManualImportSummary {
  const positions = payload.accounts.flatMap((account) => account.positions);
  return {
    accounts: payload.accounts.length,
    positions: positions.length,
    options: positions.filter((position) => position.type === "option").length,
    withoutPrice: positions.filter((position) => position.price === undefined).length,
    symbols: [...new Set(positions.map((position) => position.underlying || position.symbol))],
  };
}
