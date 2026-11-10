// The Web's CompanyValuationCalculator: AI-proposed or hand-entered assumptions,
// every value computed by the backend's deterministic DCF / PE / PEG models.
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { MODEL_CONFIGS, providerId } from "../lib/aiModels";
import {
  applyAiAssumptions,
  buildCompanyCommand,
  companyScenarios,
  initialCompanyDraft,
  type CompanyAiResult,
  type CompanyDraft,
  type CompanyInput,
  type CompanyInputs,
  type CompanyModel,
  type CompanyResult,
} from "../lib/companyValuation";
import {
  ValuationError,
  calculateCompany,
  generateAiAssumptions,
  loadAiRuns,
  loadCompanyInputs,
} from "../lib/companyValuationApi";
import { apiRequest } from "../lib/http";
import { safeExternal } from "../lib/links";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { useAuth } from "../state/Auth";
import { usePreferences } from "../state/Preferences";
import { Field, Filters } from "./Content";
import {
  Button,
  Copy,
  Failure,
  Glass,
  LoadingStatus,
  Section,
  Skeleton,
  styles,
} from "./UI";

const NAMES = { conservative: "保守", base: "基准", optimistic: "乐观" };
const INPUT_LABELS: Record<CompanyInput, string> = {
  revenue: "全年／TTM 营收（十亿美元）",
  eps: "TTM EPS（美元／股）",
  shares: "流通在外股数（百万股）",
  cash: "非经营现金（十亿美元）",
  debt: "债务（十亿美元）",
  other_claims: "其他权益请求权（十亿美元）",
  tax_rate: "税率（%）",
};
const FIELD_LABELS: Record<string, string> = {
  revenue_growth: "年营收增长率（%）",
  starting_margin: "起始营业利润率（%）",
  operating_margin: "预测期末营业利润率（%）",
  reinvestment_rate: "再投资／税后营业利润（%）",
  discount_rate: "加权平均资本成本 WACC（%）",
  target_pe: "目标 PE（倍）",
  target_peg: "目标 PEG（倍）",
  eps_growth: "未来3–5年 EPS 年增长率（%）",
};
const BOUNDS: Record<
  string,
  { min: number; max: number; exclusiveMin?: boolean }
> = {
  revenue_growth: { min: -100, max: 200, exclusiveMin: true },
  starting_margin: { min: -1000, max: 100 },
  operating_margin: { min: -100, max: 100 },
  reinvestment_rate: { min: 0, max: 200 },
  discount_rate: { min: 0, max: 100, exclusiveMin: true },
  target_pe: { min: 0, max: 500, exclusiveMin: true },
  target_peg: { min: 0, max: 10, exclusiveMin: true },
  eps_growth: { min: 0, max: 200, exclusiveMin: true },
};
const AI_ERRORS: Record<string, string> = {
  ai_not_configured: "请先为所选模型配置 API Key。",
  ai_key_rejected: "服务商拒绝了这个 API Key，请到设置中检查。",
  ai_rate_limited: "短时间内 AI 估值次数过多，请几分钟后再试。",
  ai_not_applicable:
    "这家公司既不具备标准 DCF 的输入，也没有正 EPS，暂时无法进行 AI 估值。",
  ai_assumptions_invalid: "模型返回的假设未通过校验，请重试或换一个模型。",
  ai_analysis_timeout: "模型响应超时，请重试或换一个更快的模型。",
  company_snapshot_changed: "财务快照已变更，请刷新财务数据后重试。",
  Unauthorized: "请重新登录后使用 AI 估值。",
};
const ASSUMPTION_NOTES: Record<CompanyModel, string> = {
  dcf: "初始试算：营收零增长、沿用财报营业利润率、预测期再投资为0，WACC为12%／10%／8%，永续增长率2%、ROIC为10%。这些是可修改的试算假设，并非已校准预测或计算得到的资本成本。利润率从起始值逐年直线过渡到预测期末值；亏损年份不计税，也不计再投资。再投资指固定资产、营运资本等经营资产的净投入。",
  pe: "请为三个情景填写有依据的目标 PE；不会把当前市场 PE 自动当作合理估值。此处使用 TTM EPS，不额外推算未来 EPS。",
  peg: "隐含 PE＝目标 PEG×EPS 年增长率（百分数）。初始 PEG 只是试算假设；请填写正的、可持续的 EPS 增速，亏损或盈利不稳定时不适用。",
};

function useMoney() {
  const { locale } = usePreferences();
  const region = locale === "zh" ? "zh-CN" : "en-US";
  const money = (v: number | null | undefined, compact = false) =>
    v == null || !Number.isFinite(v)
      ? "—"
      : new Intl.NumberFormat(region, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 2,
          ...(compact ? { notation: "compact" as const } : {}),
        }).format(v);
  const percent = (v: number | null | undefined) =>
    v == null || !Number.isFinite(v)
      ? "—"
      : new Intl.NumberFormat(region, {
          style: "percent",
          maximumFractionDigits: 1,
        }).format(v);
  const time = (v: string) => new Date(v).toLocaleString(region);
  const plain = (v: number) =>
    v.toLocaleString(region, { maximumFractionDigits: 2 });
  return { money, percent, time, plain };
}

function NumericField({
  label,
  value,
  onChange,
  note,
  min,
  max,
  exclusiveMin = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  note?: string;
  min?: number;
  max?: number;
  exclusiveMin?: boolean;
}) {
  const n = Number(value);
  const invalid =
    value !== "" &&
    (!Number.isFinite(n) ||
      (min != null && (n < min || (exclusiveMin && n === min))) ||
      (max != null && n > max));
  const range =
    min != null && max != null
      ? `${min} ${exclusiveMin ? "<" : "≤"} x ≤ ${max}`
      : undefined;
  return (
    <View style={{ gap: 4 }}>
      <Field
        label={label}
        value={value}
        onChangeText={onChange}
        keyboardType="numbers-and-punctuation"
        autoCorrect={false}
        returnKeyType="done"
        style={invalid ? { textDecorationLine: "underline" } : undefined}
      />
      {(!!note || !!range) && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {!!note && (
            <Copy size={12} muted>
              {note}
            </Copy>
          )}
          {!!range && (
            <Copy size={12} muted={!invalid} localize={false}>
              {range}
            </Copy>
          )}
        </View>
      )}
    </View>
  );
}

/** A disclosure row like the Web's <details>. */
function Disclosure({
  title,
  initiallyOpen = false,
  children,
}: {
  title: string;
  initiallyOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={{ gap: 16 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={[styles.row, { minHeight: 44 }]}
      >
        <Copy bold>{title}</Copy>
        <Copy muted localize={false}>
          {open ? "⌃" : "⌄"}
        </Copy>
      </Pressable>
      {open && children}
    </View>
  );
}

export function CompanyCalculator({ symbol }: { symbol: string }) {
  const resource = useResource(
    `company-inputs:${symbol}`,
    (signal) => loadCompanyInputs(symbol, signal),
    45_000,
  );
  if (resource.loading && !resource.data)
    return (
      <LoadingStatus label="正在读取公司财务数据…">
        <Glass style={{ padding: 20, gap: 12 }}>
          <Skeleton height={20} width="50%" />
          <Skeleton height={14} width="80%" />
          <Skeleton height={120} />
        </Glass>
      </LoadingStatus>
    );
  if (!resource.data || resource.data.status !== "available")
    return (
      <Glass style={{ padding: 20, gap: 12 }}>
        <Section title="公司估值计算" />
        <Copy size={14} muted>
          {resource.data?.status === "unsupported"
            ? "自动取数目前支持美元上市、使用美元财报的美国公司普通股。"
            : "财务数据暂时不可用，请重试获取。"}
        </Copy>
        <Button onPress={resource.refresh} disabled={resource.loading}>
          重试
        </Button>
      </Glass>
    );
  return (
    <Calculator
      key={symbol}
      data={resource.data}
      refresh={resource.refresh}
      refreshing={resource.loading}
      refreshFailed={Boolean(resource.error)}
    />
  );
}

function Calculator({
  data,
  refresh,
  refreshing,
  refreshFailed,
}: {
  data: CompanyInputs;
  refresh: () => void;
  refreshing: boolean;
  refreshFailed: boolean;
}) {
  const t = useTheme();
  const f = useMoney();
  const { locale } = usePreferences();
  const user = useAuth().session?.user.id ?? "";
  const [model, setModel] = useState<CompanyModel>(
    data.dcf_exclusion ? "pe" : "dcf",
  );
  const [draft, setDraft] = useState<CompanyDraft>(() =>
    initialCompanyDraft(data),
  );
  const [touched, setTouched] = useState(false);
  // A refreshed snapshot keeps the reader's own edits and replaces untouched defaults.
  const [source, setSource] = useState(data);
  if (source.snapshot_id !== data.snapshot_id) {
    const before = initialCompanyDraft(source);
    const after = initialCompanyDraft(data);
    setSource(data);
    setDraft((previous) => ({
      ...previous,
      inputs: Object.fromEntries(
        (Object.keys(after.inputs) as CompanyInput[]).map((key) => [
          key,
          previous.edited.includes(key)
            ? previous.inputs[key]
            : after.inputs[key],
        ]),
      ) as CompanyDraft["inputs"],
      scenarios: Object.fromEntries(
        companyScenarios.map((name) => [
          name,
          Object.fromEntries(
            Object.keys(after.scenarios[name]).map((key) => [
              key,
              previous.scenarios[name][key] === before.scenarios[name][key]
                ? after.scenarios[name][key]
                : previous.scenarios[name][key],
            ]),
          ),
        ]),
      ) as CompanyDraft["scenarios"],
    }));
  }
  const edit = (next: (previous: CompanyDraft) => CompanyDraft) => {
    setTouched(true);
    setDraft(next);
  };

  const providers = useResource(`providers:${user}`, (signal) =>
    apiRequest<{ available_providers: string[] }>(
      "/user-api-keys/available-providers",
      { signal, authenticated: true, expectedUser: user },
    ),
  );
  const eligible = MODEL_CONFIGS.filter((item) =>
    providers.data?.available_providers.includes(providerId[item.provider]),
  );
  const [chosenModel, setChosenModel] = useState("");
  const aiModel = eligible.some((item) => item.id === chosenModel)
    ? chosenModel
    : (eligible[0]?.id ?? "");
  const [ai, setAi] = useState<CompanyAiResult | null>(null);
  const [aiRequest, setAiRequest] = useState<{
    pending: boolean;
    error?: string;
  }>({ pending: false });
  const aiController = useRef<AbortController | null>(null);
  useEffect(() => () => aiController.current?.abort(), []);
  const [runs, setRuns] = useState<CompanyAiResult[]>([]);
  const [runsFailed, setRunsFailed] = useState(false);

  // Assumptions from another run must not linger, but the reader's financial overrides stay.
  const showRun = (run: CompanyAiResult) => {
    setAi(run);
    setModel(run.primary_model);
    setDraft((previous) =>
      applyAiAssumptions(
        {
          ...initialCompanyDraft(data),
          inputs: previous.inputs,
          edited: previous.edited,
        },
        run,
      ),
    );
  };
  // Reopen on the latest saved result unless the reader has already started working.
  const restore = useEffectEvent((items: CompanyAiResult[]) => {
    setRuns(items);
    if (items[0] && !touched) showRun(items[0]);
  });
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    loadAiRuns(data.symbol, user, controller.signal)
      .then(restore)
      .catch((failure) => {
        if (
          !controller.signal.aborted &&
          !(failure instanceof ValuationError && failure.status === 401)
        )
          setRunsFailed(true);
      });
    return () => controller.abort();
  }, [data.symbol, user]);

  const runAi = (regenerate: boolean) => {
    if (!aiModel || !user) return;
    aiController.current?.abort();
    const controller = new AbortController();
    aiController.current = controller;
    setAiRequest({ pending: true });
    setTouched(true);
    generateAiAssumptions(
      data.symbol,
      { snapshot_id: data.snapshot_id, model: aiModel, locale, regenerate },
      user,
      controller.signal,
    )
      .then((next) => {
        if (controller.signal.aborted) return;
        showRun(next);
        setAiRequest({ pending: false });
        if (next.run_id)
          setRuns((previous) => [
            next,
            ...previous.filter((run) => run.run_id !== next.run_id),
          ]);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setAiRequest({
            pending: false,
            error:
              failure instanceof Error ? failure.message : "ai_unavailable",
          });
      });
  };

  let commandKey = "";
  let validation = "";
  try {
    commandKey = JSON.stringify(buildCompanyCommand(data, model, draft));
  } catch (error) {
    validation = error instanceof Error ? error.message : "required";
  }
  const [success, setSuccess] = useState<{
    key: string;
    data: CompanyResult;
  } | null>(null);
  const [request, setRequest] = useState<{
    key: string;
    error?: string;
    pending?: boolean;
  }>({ key: "" });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!commandKey) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setRequest({ key: commandKey, pending: true });
      calculateCompany(data.symbol, JSON.parse(commandKey), controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          setSuccess({ key: commandKey, data: result });
          setRequest({ key: commandKey });
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          const status = error instanceof ValuationError ? error.status : 0;
          setRequest({
            key: commandKey,
            error:
              status === 409
                ? "snapshot"
                : error.message === "scenario_values_cross"
                  ? "cross"
                  : status === 422
                    ? "invalid"
                    : "network",
          });
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [commandKey, data.symbol, retry]);

  const result =
    success?.data.model === model &&
    success.data.snapshot_id === data.snapshot_id
      ? success.data
      : null;
  const stale = Boolean(result && success?.key !== commandKey);
  const error = request.key === commandKey ? request.error : undefined;
  const pending = Boolean(
    commandKey && (request.key !== commandKey || request.pending),
  );
  const base = result?.scenarios.base;
  const inputKeys: CompanyInput[] =
    model === "dcf"
      ? ["revenue", "shares", "cash", "debt", "other_claims", "tax_rate"]
      : ["eps", "shares"];
  const fields =
    model === "dcf"
      ? [
          "revenue_growth",
          "starting_margin",
          "operating_margin",
          "reinvestment_rate",
          "discount_rate",
        ]
      : model === "pe"
        ? ["target_pe"]
        : ["target_peg", "eps_growth"];
  const originLabel = (key: CompanyInput) =>
    draft.edited.includes(key)
      ? "用户假设"
      : data.origins[key] === "assumed_21_percent"
        ? "暂按21%假设，请复核"
        : data.origins[key] === "missing_components_assumed_zero"
          ? "缺失项目暂按0，请复核"
          : data.origins[key] === "unavailable"
            ? "数据缺失，请填写"
            : "供应商财务数据";
  const warning =
    error === "snapshot"
      ? "财务快照已变更，请刷新数据后重新计算。"
      : error === "cross"
        ? "情景估值交叉，请调整假设，使保守值 ≤ 基准值 ≤ 乐观值。"
        : error === "network"
          ? "计算暂时失败，请重试或修改假设。"
          : error
            ? "部分假设无法计算，请检查数值范围与终值条件。"
            : validation === "terminal"
              ? "WACC 与永续 ROIC 都必须大于永续增长率。"
              : validation === "range"
                ? "请检查输入范围；增长率等按百分数填写，PE 与 PEG 必须大于0。"
                : validation
                  ? "请补全财务输入及三个情景的假设后计算。"
                  : "";
  const status = pending
    ? "计算中…"
    : stale
      ? "上次有效结果 · 新假设尚未应用"
      : result
        ? "已按下方假设计算"
        : error
          ? "计算未完成"
          : "等待填写假设";
  const aiReference = ai
    ? applyAiAssumptions(initialCompanyDraft(data), ai)
    : null;
  const aiEdited = Boolean(
    aiReference &&
    JSON.stringify([
      aiReference.scenarios,
      aiReference.years,
      aiReference.terminal_growth,
      aiReference.terminal_roic,
    ]) !==
      JSON.stringify([
        draft.scenarios,
        draft.years,
        draft.terminal_growth,
        draft.terminal_roic,
      ]),
  );
  const lossMaking = data.inputs.eps != null && data.inputs.eps <= 0;
  const modelName = (id: string) =>
    MODEL_CONFIGS.find((item) => item.id === id)?.name ?? id;
  const pristine =
    JSON.stringify(draft) === JSON.stringify(initialCompanyDraft(data));

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <Section title="公司估值计算器" />
        <Copy size={12} muted>
          {data.income_basis === "ttm_four_quarters"
            ? "营收口径 · TTM 截至供应商财报期"
            : "营收口径 · 使用最近可用财年，非 TTM"}
        </Copy>
        <Copy size={12} muted localize={false}>
          {`${data.income_periods[0] ?? "—"} · ${data.balance_period ?? "—"}`}
        </Copy>
        <Button onPress={refresh} disabled={refreshing}>
          {refreshing ? "刷新中…" : "刷新财务数据"}
        </Button>
        {refreshFailed && (
          <Copy size={14} muted>
            刷新失败，正在使用上次成功获取的财务快照。
          </Copy>
        )}
      </View>

      <Glass style={{ padding: 16, gap: 12 }}>
        <Copy bold>AI 一键估值</Copy>
        <Copy size={12} muted>
          AI
          读取财务数据和分析师预期，提出三个情景的假设；所有估值都由下方模型计算。当前股价不会发给
          AI，避免它倒推出接近现价的结果。
        </Copy>
        {!providers.loading && !eligible.length ? (
          <>
            <Copy size={14} muted>
              还没有配置 API Key。
            </Copy>
            <Button onPress={() => router.push("/preferences")}>
              前往设置添加
            </Button>
          </>
        ) : (
          <>
            <Filters
              values={eligible.map((item) => [item.id, item.name] as const)}
              value={aiModel}
              onChange={setChosenModel}
              disabled={aiRequest.pending}
            />
            <Button
              variant="primary"
              disabled={!aiModel || aiRequest.pending}
              onPress={() => runAi(Boolean(ai))}
            >
              {aiRequest.pending
                ? "AI 生成中…"
                : ai
                  ? "重新生成"
                  : "开始 AI 估值"}
            </Button>
          </>
        )}
        {runs.length > 1 && (
          <View style={{ gap: 8 }}>
            <Copy size={14} bold>
              已保存的结果
            </Copy>
            <Filters
              values={runs.map(
                (run) =>
                  [
                    run.run_id!,
                    `${f.time(run.generated_at)} · ${modelName(run.model_id)}`,
                  ] as const,
              )}
              value={ai?.run_id ?? ""}
              disabled={aiRequest.pending}
              onChange={(id) => {
                const run = runs.find((item) => item.run_id === id);
                if (run) showRun(run);
              }}
            />
          </View>
        )}
        {runsFailed && (
          <Copy size={14} muted>
            已保存的结果暂时无法读取。
          </Copy>
        )}
        {aiRequest.pending && (
          <Copy size={14} muted>
            通常一分钟内完成；本次调用使用你的 API Key 计费。
          </Copy>
        )}
        {!!aiRequest.error && (
          <Failure
            message={
              AI_ERRORS[aiRequest.error] ?? "AI 估值暂时不可用，请稍后重试。"
            }
          />
        )}
      </Glass>

      <Filters
        values={[
          ["dcf", "DCF · 现金流折现"],
          ["pe", "PE"],
          ["peg", "PEG"],
        ]}
        value={model}
        onChange={(value) => {
          if (value === "dcf" && data.dcf_exclusion) return;
          setModel(value as CompanyModel);
        }}
      />
      {!!data.dcf_exclusion && (
        <Copy size={14} muted>
          金融公司与 REITs 需要专用估值模型，暂不提供标准 FCFF DCF。
        </Copy>
      )}

      <Glass style={{ padding: 16, gap: 12 }}>
        <View style={styles.row}>
          <Copy bold>估值结果</Copy>
          <Copy size={12} muted>
            {status}
          </Copy>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          <Copy size={14} muted>
            行情价格
          </Copy>
          <Copy size={14} bold localize={false}>
            {f.money(data.price)}
          </Copy>
          <Copy size={14} muted>
            · 按此价格计算的市值
          </Copy>
          <Copy size={14} localize={false}>
            {f.money(data.market_cap_reference, true)}
          </Copy>
        </View>
        {data.quote_time ? (
          <Copy size={12} muted localize={false}>
            {f.time(data.quote_time)}
          </Copy>
        ) : (
          <Copy size={12} muted>
            行情时间不可用
          </Copy>
        )}
        {result?.status === "not_applicable" ? (
          <Copy size={14}>
            {result.reason === "positive_eps_required"
              ? "PE／PEG 需要正 EPS，请切换 DCF 或复核 EPS。"
              : "该公司需要金融或房地产行业专用模型，暂不提供标准 FCFF DCF。"}
          </Copy>
        ) : (
          companyScenarios.map((name) => {
            const row = result?.scenarios[name];
            return (
              <View
                key={name}
                style={{
                  gap: 6,
                  padding: 16,
                  borderRadius: 18,
                  backgroundColor: t.wash,
                }}
              >
                <Copy size={14} bold>
                  {NAMES[name]}
                </Copy>
                <Copy size={24} bold localize={false}>
                  {f.money(row?.fair_price)}
                </Copy>
                <Copy size={12} muted>
                  模型每股价值
                </Copy>
                <Pair
                  label="股权价值"
                  value={f.money(row?.equity_value, true)}
                />
                {model === "dcf" && (
                  <Pair
                    label="企业价值"
                    value={f.money(row?.enterprise_value, true)}
                  />
                )}
                <Pair
                  label="相对现价空间"
                  value={f.percent(row?.comparison?.price_space)}
                />
                {row?.status === "nonpositive_equity_value" && (
                  <Copy size={12}>股权价值≤0，不输出正每股价值。</Copy>
                )}
                {row?.status === "not_applicable" && (
                  <Copy size={12}>终值现金流非正，此模型不适用。</Copy>
                )}
              </View>
            );
          })
        )}
        {lossMaking && model !== "dcf" && (
          <Copy size={14} muted>
            TTM EPS 为负，PE 和 PEG 没有意义，AI 估值只生成
            DCF。如果仍想试算，可在“财务输入与来源”里填写你预期的 EPS。
          </Copy>
        )}
        {model === "dcf" && base?.status === "not_applicable" && (
          <Copy size={14} muted>
            请在下方把预测期末营业利润率改成正数，或使用 AI 估值。
          </Copy>
        )}
        <Copy size={12} muted>
          结果取决于输入假设，不代表分析师共识或置信区间。价格空间＝模型每股价值÷标注行情价格−1。
        </Copy>
      </Glass>

      {ai && (
        <Glass style={{ padding: 16, gap: 12 }}>
          <Copy bold>AI 的假设依据</Copy>
          <Copy size={12} muted localize={false}>
            {`${modelName(ai.model_id)} · ${f.time(ai.generated_at)}`}
          </Copy>
          {ai.cached && (
            <Copy size={12} muted>
              缓存结果
            </Copy>
          )}
          {!!ai.results?.[ai.primary_model]?.base && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              <Copy size={14} muted>
                生成时 · 基准每股价值
              </Copy>
              <Copy size={14} bold localize={false}>
                {f.money(ai.results[ai.primary_model]?.base.fair_price)}
              </Copy>
              <Copy size={14} muted>
                · 当时股价
              </Copy>
              <Copy size={14} bold localize={false}>
                {f.money(ai.price_at_generation)}
              </Copy>
            </View>
          )}
          {!ai.saved && (
            <Copy size={14} muted>
              这次结果未能保存，离开页面后会丢失；当前仍可正常使用。
            </Copy>
          )}
          <Copy size={14} localize={false} selectable>
            {ai.summary}
          </Copy>
          {ai.rationale.map((item, i) => (
            <View key={`${item.assumption}-${i}`} style={{ gap: 2 }}>
              <Copy size={14} bold localize={false}>
                {item.assumption}
              </Copy>
              <Copy size={14} muted localize={false}>
                {item.reason}
              </Copy>
            </View>
          ))}
          {ai.risks.length > 0 && (
            <View style={{ gap: 4 }}>
              <Copy size={14} bold>
                哪些情况会让这些假设失效
              </Copy>
              {ai.risks.map((risk, i) => (
                <Copy key={`${risk}-${i}`} size={14} muted localize={false}>
                  {`• ${risk}`}
                </Copy>
              ))}
            </View>
          )}
          {aiEdited && (
            <Copy size={12} muted>
              你已修改部分 AI 假设，上方结果按你的数值计算。
            </Copy>
          )}
          {ai.snapshot_id !== data.snapshot_id && (
            <Copy size={12} muted>
              生成后财务数据已更新，上方结果是把这些假设用在最新数据上；可重新生成。
            </Copy>
          )}
          <Copy size={12} muted>
            {ai.used_consensus ? "已参考分析师预期。" : "未取得分析师预期。"}
          </Copy>
          <Copy size={12} muted>
            AI 生成的假设可能有误，请复核后再参考；本结果不构成投资建议。
          </Copy>
        </Glass>
      )}

      <Glass style={{ padding: 16, gap: 16 }}>
        <Copy bold>情景假设</Copy>
        <Copy size={12} muted>
          {ASSUMPTION_NOTES[model]}
        </Copy>
        <Button
          disabled={pristine}
          onPress={() => {
            setDraft(initialCompanyDraft(data));
            setAi(null);
          }}
        >
          重置假设
        </Button>
        {companyScenarios.map((name) => (
          <View key={name} style={{ gap: 12 }}>
            <Copy size={14} bold>
              {NAMES[name]}
            </Copy>
            {fields.map((key) => (
              <NumericField
                key={key}
                {...BOUNDS[key]}
                label={FIELD_LABELS[key]}
                value={draft.scenarios[name][key]}
                onChange={(value) =>
                  edit((previous) => ({
                    ...previous,
                    scenarios: {
                      ...previous.scenarios,
                      [name]: { ...previous.scenarios[name], [key]: value },
                    },
                  }))
                }
              />
            ))}
          </View>
        ))}
        {model === "dcf" && (
          <View
            style={{
              gap: 12,
              paddingTop: 16,
              borderTopWidth: 1,
              borderColor: t.border,
            }}
          >
            <Copy size={14} bold>
              预测期
            </Copy>
            <Filters
              values={[
                ["5", "5年"],
                ["10", "10年"],
              ]}
              value={draft.years}
              onChange={(years) => edit((p) => ({ ...p, years }))}
            />
            <NumericField
              label="永续增长率（%）"
              value={draft.terminal_growth}
              note="范围0–5%，须低于各情景 WACC"
              onChange={(terminal_growth) =>
                edit((p) => ({ ...p, terminal_growth }))
              }
            />
            <NumericField
              label="永续 ROIC（%）"
              value={draft.terminal_roic}
              note="终值再投资率＝永续增长率／ROIC"
              onChange={(terminal_roic) =>
                edit((p) => ({ ...p, terminal_roic }))
              }
            />
          </View>
        )}
        {!!warning && (
          <Copy size={14} muted>
            {warning}
          </Copy>
        )}
        {!!warning && stale && (
          <Copy size={14} muted>
            上方保留上次有效结果。
          </Copy>
        )}
        {(error === "network" || error === "snapshot") && (
          <Button
            onPress={() => {
              if (error === "snapshot") refresh();
              else {
                setRequest({ key: "" });
                setRetry((value) => value + 1);
              }
            }}
          >
            {error === "snapshot" ? "刷新数据" : "重试计算"}
          </Button>
        )}
      </Glass>

      <Glass style={{ padding: 16 }}>
        <Disclosure
          title="财务输入与来源"
          initiallyOpen={inputKeys.some((key) => data.inputs[key] == null)}
        >
          <Copy size={12} muted localize={false}>
            {`Yahoo Finance · ${data.income_periods.join(" / ") || "—"} · ${data.balance_period ?? "—"} · ${f.time(data.fetched_at)}`}
          </Copy>
          {inputKeys.map((key) => (
            <NumericField
              key={key}
              label={INPUT_LABELS[key]}
              value={draft.inputs[key]}
              note={originLabel(key)}
              onChange={(value) =>
                edit((previous) => ({
                  ...previous,
                  inputs: { ...previous.inputs, [key]: value },
                  edited: Array.from(new Set([...previous.edited, key])),
                }))
              }
            />
          ))}
          <Copy size={12} muted>
            股数默认取当前流通在外股数，并非完全稀释股数，可手动调整预期摊薄。现金默认使用披露的全部现金及短期投资，请复核经营所需及受限现金。其他权益请求权含优先股和少数股东权益，缺失项目暂按0。债务及其他请求权默认使用披露的账面余额近似值，可按市场价值调整。EPS及股数为供应商当前指标，上方财报期标注利润表和资产负债表口径；日期采用供应商标准化口径。
          </Copy>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <SourceText url={data.sources.financials} label="利润表来源" />
            <SourceText
              url={data.sources.balance_sheet}
              label="资产负债表来源"
            />
          </View>
        </Disclosure>
      </Glass>

      {model === "dcf" && base?.enterprise_value != null && (
        <Glass style={{ padding: 16, gap: 12 }}>
          <Copy bold>基准情景 · 企业价值到股权价值</Copy>
          <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
            {(
              [
                ["企业价值", f.money(base.enterprise_value, true)],
                ["＋非经营现金", f.money(result?.inputs.cash, true)],
                ["−债务", f.money(result?.inputs.debt, true)],
                ["−其他权益请求权", f.money(result?.inputs.other_claims, true)],
                ["＝股权价值", f.money(base.equity_value, true)],
                ["终值现值／企业价值", f.percent(base.terminal_value_share)],
              ] as const
            ).map(([label, value]) => (
              <View key={label} style={{ width: "50%", gap: 2 }}>
                <Copy size={12} muted>
                  {label}
                </Copy>
                <Copy size={15} bold localize={false}>
                  {value}
                </Copy>
              </View>
            ))}
          </View>
          <Disclosure title="预测现金流与敏感性">
            <Copy size={12} muted>
              基准情景 · 十亿美元 · FCFF＝税后营业利润−净再投资
            </Copy>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <TableRow
                  header
                  cells={["年份", "营收", "NOPAT", "再投资", "FCFF", "现值"]}
                />
                {base.forecast?.map((row) => (
                  <TableRow
                    key={row.year}
                    cells={[
                      String(row.year),
                      ...[
                        row.revenue,
                        row.nopat,
                        row.reinvestment,
                        row.fcff,
                        row.present_value,
                      ].map((v) => f.plain(v / 1e9)),
                    ]}
                  />
                ))}
              </View>
            </ScrollView>
            <Copy size={12} muted>
              基准每股价值 · WACC 与永续增长率敏感性
            </Copy>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <TableRow
                  header
                  cells={[
                    "WACC",
                    ...(result?.sensitivity
                      .slice(0, 3)
                      .map((v) => f.percent(v.terminal_growth)) ?? []),
                  ]}
                />
                {[0, 3, 6].map((start) => (
                  <TableRow
                    key={start}
                    cells={[
                      f.percent(result?.sensitivity[start]?.discount_rate),
                      ...(result?.sensitivity
                        .slice(start, start + 3)
                        .map((cell) => f.money(cell.fair_price)) ?? []),
                    ]}
                  />
                ))}
              </View>
            </ScrollView>
          </Disclosure>
          <Copy size={12} muted>
            FCFF 按 WACC 折现经营现金流，终值按增长率／ROIC
            扣除必要再投资。股权价值＝企业价值＋非经营现金−债务−其他权益请求权；每股价值＝股权价值／输入股数。
          </Copy>
        </Glass>
      )}
    </View>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Copy size={12} muted>
        {label}
      </Copy>
      <Copy size={12} localize={false}>
        {value}
      </Copy>
    </View>
  );
}
function TableRow({
  cells,
  header = false,
}: {
  cells: string[];
  header?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderColor: t.border,
      }}
    >
      {cells.map((cell, i) => (
        <View key={i} style={{ width: i === 0 ? 72 : 88, padding: 8 }}>
          <Copy size={12} bold={header} muted={header} localize={header}>
            {cell}
          </Copy>
        </View>
      ))}
    </View>
  );
}
function SourceText({ url, label }: { url: string; label: string }) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);
  const safe = safeExternal(url);
  if (!safe) return null;
  return (
    <Copy
      size={14}
      role="link"
      color={failed ? t.negative : t.accent}
      onPress={() => void Linking.openURL(safe).catch(() => setFailed(true))}
    >
      {label}
    </Copy>
  );
}
