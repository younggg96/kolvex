"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { InfoTip } from "@/components/ui/info-tip";
import { SettingsGroup, SettingsRow } from "@/components/ui/settings-group";

type Kind = "daily_brief" | "holdings_change";
interface EmailSetting {
  kind: Kind; enabled: boolean; send_time: string; timezone: string; weekdays: number[];
  from_name: string; from_email: string; reply_to: string; subject_template: string;
  last_sent_on: string | null; last_run_at: string | null; last_status: string | null;
  last_error: string | null; last_recipient_count: number | null;
}

const LABELS: Record<Kind, { title: string; hint: string }> = {
  daily_brief: { title: "每日简报邮件", hint: "发送当天已发布的日报，收件人为开启邮件通知的用户。变量：{title} {date}" },
  holdings_change: { title: "机构持仓更新邮件", hint: "自上次发送后新增的 13F 持仓披露。变量：{date}" },
};
const DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const STATUS: Record<string, string> = { sent: "已发送", skipped: "无内容，稍后重试", failed: "失败" };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "请求失败");
  return result;
}

function Card({ initial, onSaved }: { initial: EmailSetting; onSaved: () => void }) {
  const [form, setForm] = useState(initial);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const set = <K extends keyof EmailSetting>(key: K, value: EmailSetting[K]) => setForm((f) => ({ ...f, [key]: value }));
  const url = `/api/admin/email-settings?kind=${form.kind}`;
  const input = "h-9 w-full max-w-[17.5rem] rounded-lg border border-border bg-background px-3 text-sm";

  async function run(action: () => Promise<string>) {
    setBusy(true); setMessage("");
    try { setMessage(await action()); } catch (e) { setMessage(e instanceof Error ? e.message : "操作失败"); }
    finally { setBusy(false); }
  }
  const save = () => run(async () => {
    const { kind, enabled, send_time, timezone, weekdays, from_name, from_email, reply_to, subject_template } = form;
    void kind;
    await request(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, send_time, timezone, weekdays, from_name, from_email, reply_to, subject_template }) });
    onSaved();
    return "已保存";
  });
  const sendTest = () => run(async () => {
    const r = await request<{ sent: number; skipped: string | null }>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: testTo }) });
    return r.skipped ? r.skipped : `测试邮件已发送至 ${testTo}`;
  });

  return (
    <section className="space-y-6">
      <SettingsGroup
        label={LABELS[form.kind].title}
        action={<InfoTip label={LABELS[form.kind].title}>{LABELS[form.kind].hint}</InfoTip>}
      >
        <SettingsRow label="启用">
          <Switch checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} aria-label="启用" />
        </SettingsRow>
        <SettingsRow input label="发送时间"><input type="time" className={input} value={form.send_time} onChange={(e) => set("send_time", e.target.value)} /></SettingsRow>
        <SettingsRow input label="时区"><input className={input} value={form.timezone} onChange={(e) => set("timezone", e.target.value)} /></SettingsRow>
        <SettingsRow label="发送日">
          <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-sm text-foreground">
            {DAYS.map((label, day) => (
              <label key={day} className="flex items-center gap-1.5">
                <input type="checkbox" checked={form.weekdays.includes(day)} onChange={(e) => set("weekdays", e.target.checked ? [...form.weekdays, day].sort() : form.weekdays.filter((d) => d !== day))} />{label}
              </label>
            ))}
          </div>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup label="发件">
        <SettingsRow input label="发件人名称"><input className={input} value={form.from_name} onChange={(e) => set("from_name", e.target.value)} /></SettingsRow>
        <SettingsRow input label="发件邮箱"><input type="email" className={input} value={form.from_email} onChange={(e) => set("from_email", e.target.value)} /></SettingsRow>
        <SettingsRow input label="回复邮箱"><input type="email" className={input} value={form.reply_to} onChange={(e) => set("reply_to", e.target.value)} /></SettingsRow>
        <SettingsRow input label="标题模板"><input className={input} value={form.subject_template} onChange={(e) => set("subject_template", e.target.value)} /></SettingsRow>
      </SettingsGroup>

      <SettingsGroup label="运行状态">
        <SettingsRow label="上次运行">
          {form.last_run_at ? new Date(form.last_run_at).toLocaleString() : "—"}
          {form.last_status && ` · ${STATUS[form.last_status] ?? form.last_status}`}
          {form.last_recipient_count != null && ` · ${form.last_recipient_count} 人`}
        </SettingsRow>
        {form.last_error && <SettingsRow label="错误"><span className="text-negative">{form.last_error}</span></SettingsRow>}
        <SettingsRow input label="发送测试">
          <input type="email" placeholder="测试收件邮箱" className={`${input} max-w-60`} value={testTo} onChange={(e) => setTestTo(e.target.value)} />
        </SettingsRow>
      </SettingsGroup>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {message && <span role="status" className="mr-auto text-sm text-muted-foreground">{message}</span>}
        <Button size="sm" variant="outline" disabled={busy || !testTo} onClick={() => void sendTest()}>发送测试</Button>
        <Button size="sm" disabled={busy} onClick={() => void save()}>保存</Button>
      </div>
    </section>
  );
}

export default function EmailSettingsManager() {
  const [settings, setSettings] = useState<EmailSetting[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await request<{ settings: EmailSetting[]; resend_configured: boolean }>("/api/admin/email-settings");
      setSettings(r.settings); setConfigured(r.resend_configured);
    } catch (e) { setError(e instanceof Error ? e.message : "加载失败"); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error) return <p role="alert" className="text-sm text-negative">{error}</p>;
  if (!settings) return <p className="text-sm text-muted-foreground">加载中…</p>;
  return (
    <div className="space-y-8">
      {!configured && <p role="alert" className="rounded-3xl bg-negative/10 px-4 py-3 text-sm">后端未配置 RESEND_API_KEY，邮件不会发送。</p>}
      {settings.map((s) => <Card key={s.kind} initial={s} onSaved={() => void load()} />)}
    </div>
  );
}
