"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AdminRowsSkeleton } from "@/components/admin/AdminSkeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoTip } from "@/components/ui/info-tip";
import { Switch } from "@/components/ui/switch";
import { SettingsGroup } from "@/components/ui/settings-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Category = "classic" | "chinese" | "value" | "activist" | "growth" | "other";
interface Manager {
  id: string;
  cik: number;
  name: string;
  zh_name: string | null;
  person_en: string | null;
  person_zh: string | null;
  role_en: string | null;
  role_zh: string | null;
  category: Category;
  enabled: boolean;
  sort_order: number;
}
interface Lookup {
  cik: number;
  sec_name: string | null;
  latest_13f: { period: string; filed: string } | null;
  filings_13f: number;
  existing_id: string | null;
}
type Fields = Pick<
  Manager,
  "name" | "zh_name" | "person_en" | "person_zh" | "role_en" | "role_zh" | "category"
>;

const CATEGORIES: Record<Category, string> = {
  classic: "首批收录",
  chinese: "中文用户常关注",
  value: "价值投资",
  activist: "积极股东",
  growth: "成长与科技",
  other: "其他",
};
const TEXT_FIELDS: Array<{
  key: Exclude<keyof Fields, "category">;
  label: string;
  placeholder?: string;
}> = [
  { key: "name", label: "英文名称", placeholder: "Viking Global Investors" },
  { key: "zh_name", label: "中文名称", placeholder: "维京全球" },
  { key: "person_en", label: "代表人物（英文）", placeholder: "Andreas Halvorsen" },
  { key: "person_zh", label: "代表人物（中文）", placeholder: "安德烈亚斯·哈尔沃森" },
  { key: "role_en", label: "职位（英文）", placeholder: "Founder" },
  { key: "role_zh", label: "职位（中文）", placeholder: "创始人" },
];
const EMPTY: Fields = {
  name: "",
  zh_name: "",
  person_en: "",
  person_zh: "",
  role_en: "",
  role_zh: "",
  category: "other",
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "请求失败");
  return result;
}
const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
/** Empty inputs are saved as null so the bundled profile or the English name shows instead. */
const payload = (fields: Fields) =>
  Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? v.trim() || null : v]),
  );

function FieldsForm({
  value,
  onChange,
  idPrefix,
}: {
  value: Fields;
  onChange: (next: Fields) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TEXT_FIELDS.map((field) => (
        <label
          key={field.key}
          htmlFor={`${idPrefix}-${field.key}`}
          className="space-y-1.5 text-sm font-medium"
        >
          <span>{field.label}</span>
          <Input
            id={`${idPrefix}-${field.key}`}
            value={value[field.key] ?? ""}
            placeholder={field.placeholder}
            maxLength={field.key === "name" ? 120 : 80}
            onChange={(e) => onChange({ ...value, [field.key]: e.target.value })}
          />
        </label>
      ))}
      <div className="space-y-1.5 text-sm font-medium">
        <span id={`${idPrefix}-category`}>分组</span>
        <Select
          value={value.category}
          onValueChange={(category) => onChange({ ...value, category: category as Category })}
        >
          <SelectTrigger aria-labelledby={`${idPrefix}-category`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORIES).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function AddManager({ onAdded }: { onAdded: () => Promise<void> }) {
  const [cik, setCik] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [id, setId] = useState("");
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function check(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setLookup(null);
    try {
      const result = await request<Lookup>(
        `/api/admin/institutions?cik=${encodeURIComponent(cik.trim())}`,
      );
      setLookup(result);
      setFields({ ...EMPTY, name: result.sec_name ?? "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "查询失败");
    } finally {
      setBusy(false);
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!lookup) return;
    setBusy(true);
    setError("");
    try {
      await request(
        "/api/admin/institutions",
        json("POST", { id: id.trim().toLowerCase(), cik: lookup.cik, ...payload(fields) }),
      );
      setNotice(`已加入 ${fields.name}，13F 持仓会在后台同步，几分钟后出现在超级投资者页。`);
      setLookup(null);
      setCik("");
      setId("");
      setFields(EMPTY);
      await onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "添加失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsGroup label="添加机构">
      <div className="space-y-4 p-4">
        <form onSubmit={check} className="flex flex-wrap items-end gap-2">
          <label
            htmlFor="institution-cik"
            className="min-w-0 flex-1 space-y-1.5 text-sm font-medium"
          >
            <span className="inline-flex items-center gap-1">
              SEC CIK
              <InfoTip label="说明">
                在 SEC EDGAR 搜索机构名称即可看到 CIK。只有提交过 13F-HR 的机构才能加入。
              </InfoTip>
            </span>
            <Input
              id="institution-cik"
              inputMode="numeric"
              value={cik}
              placeholder="1103804"
              onChange={(e) => setCik(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
          </label>
          <Button type="submit" variant="outline" disabled={busy || !cik}>
            查询 SEC
          </Button>
        </form>

        {lookup && (
          <div className="space-y-4">
            <p className="rounded-2xl bg-muted px-4 py-3 text-sm">
              <span className="font-semibold">{lookup.sec_name ?? "未知名称"}</span>
              {" · "}
              {lookup.latest_13f
                ? `最近一份 13F-HR：${lookup.latest_13f.period} 季度（${lookup.latest_13f.filed} 提交），共 ${lookup.filings_13f} 份`
                : "没有 13F-HR 申报，不能加入"}
              {lookup.existing_id && `。已在名单中（ID：${lookup.existing_id}）`}
            </p>
            {lookup.latest_13f && !lookup.existing_id && (
              <form onSubmit={add} className="space-y-3">
                <label htmlFor="institution-id" className="block space-y-1.5 text-sm font-medium">
                  <span className="inline-flex items-center gap-1">
                    ID
                    <InfoTip label="说明">
                      用于网址，保存后不能修改。2–40 位小写字母、数字或下划线，以字母开头，例如
                      viking。
                    </InfoTip>
                  </span>
                  <Input
                    id="institution-id"
                    value={id}
                    placeholder="viking"
                    maxLength={40}
                    onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  />
                </label>
                <FieldsForm value={fields} onChange={setFields} idPrefix="new-institution" />
                <Button
                  type="submit"
                  disabled={busy || !/^[a-z][a-z0-9_]{1,39}$/.test(id) || !fields.name.trim()}
                >
                  加入名单
                </Button>
              </form>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {notice}
          </p>
        )}
      </div>
    </SettingsGroup>
  );
}

function ManagerRow({ manager, onSaved }: { manager: Manager; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<Fields>(manager);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await request(
        `/api/admin/institutions?id=${encodeURIComponent(manager.id)}`,
        json("PATCH", body),
      );
      setEditing(false);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  const byline = [manager.zh_name, manager.person_zh || manager.person_en]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="space-y-3 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{manager.name}</p>
          <p className="truncate text-[0.8125rem] text-muted-foreground">
            {[byline, CATEGORIES[manager.category], `CIK ${manager.cik}`, manager.id]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => {
              setFields(manager);
              setEditing(!editing);
            }}
          >
            {editing ? "取消" : "编辑"}
          </Button>
          <Switch
            aria-label={`${manager.enabled ? "停用" : "启用"} ${manager.name}`}
            checked={manager.enabled}
            disabled={busy}
            onCheckedChange={(enabled) => void save({ enabled })}
          />
        </div>
      </div>
      {editing && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save(payload(fields));
          }}
        >
          <FieldsForm value={fields} onChange={setFields} idPrefix={`institution-${manager.id}`} />
          <Button type="submit" size="sm" disabled={busy || !fields.name.trim()}>
            保存
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

export default function InstitutionManager() {
  const [managers, setManagers] = useState<Manager[] | null>(null);
  const [serving, setServing] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const result = await request<{ managers: Manager[]; serving: string }>(
        "/api/admin/institutions",
      );
      setManagers(result.managers);
      setServing(result.serving);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const enabled = managers?.filter((m) => m.enabled) ?? [];
  const candidates = managers?.filter((m) => !m.enabled) ?? [];
  return (
    <div className="space-y-8">
      {error && (
        <p role="alert" className="rounded-3xl bg-negative/10 px-4 py-3 text-sm text-foreground">
          {error}
        </p>
      )}
      {serving === "builtin" && (
        <p role="status" className="rounded-3xl bg-muted px-4 py-3 text-sm">
          后端暂时读不到名单表，正在使用内置的 33 家；这里的修改要等后端恢复读取后才生效。
        </p>
      )}
      <AddManager onAdded={load} />
      {managers === null && !error ? (
        <AdminRowsSkeleton label="正在加载机构名单" rows={6} lines={2} />
      ) : (
        managers && (
          <>
            <SettingsGroup label={`已启用 · ${enabled.length} 家`}>
              {enabled.length ? (
                enabled.map((m) => <ManagerRow key={m.id} manager={m} onSaved={load} />)
              ) : (
                <p className="px-4 py-3 text-sm text-muted-foreground">还没有启用的机构。</p>
              )}
            </SettingsGroup>
            {candidates.length > 0 && (
              <SettingsGroup
                label={
                  <span className="inline-flex items-center gap-1">
                    候选 · 未启用 {candidates.length} 家
                    <InfoTip label="说明">
                      CIK 已核对 SEC EDGAR。打开开关即加入超级投资者页，持仓在后台同步。
                    </InfoTip>
                  </span>
                }
              >
                {candidates.map((m) => (
                  <ManagerRow key={m.id} manager={m} onSaved={load} />
                ))}
              </SettingsGroup>
            )}
          </>
        )
      )}
    </div>
  );
}
