"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InfoTip } from "@/components/ui/info-tip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SettingsGroup, SettingsRow } from "@/components/ui/settings-group";

type Kind = "daily_brief" | "holdings_change";
type SectionId = "brief" | "kol" | "options" | "research" | "holdings";
interface Section { id: SectionId; enabled: boolean; title: string; note: string; creators?: string[] }
interface Creator { channel_id: string; channel_title: string; avatar_url: string | null; last_video_at: string | null }
type Mode = "approval" | "auto";
type Audience = "subscribers" | "all" | "custom";
interface Delivery { mode: Mode; audience: Audience; emails: string[] }
interface Content { hero_image_url: string; intro: string; sections: Section[]; delivery: Delivery }
interface AudienceCounts { subscribers: number; all: number }
interface EmailSetting {
  kind: Kind; enabled: boolean; send_time: string; timezone: string; weekdays: number[];
  from_name: string; from_email: string; reply_to: string; subject_template: string; content: Content;
  last_sent_on: string | null; last_run_at: string | null; last_status: string | null;
  last_error: string | null; last_recipient_count: number | null;
}
interface Draft {
  id: string; send_date: string; subject: string; html: string;
  status: "pending" | "sent" | "rejected" | "failed"; recipient_count: number | null; error: string | null;
}
interface Preview { subject: string | null; html: string | null; empty: string | null }

const LABELS: Record<Kind, { title: string; hint: string }> = {
  daily_brief: { title: "每日精选邮件", hint: "每天最多发送一次。标题变量：{title} {date}" },
  holdings_change: { title: "机构持仓更新邮件", hint: "自上次发送后新增的 13F 持仓披露，每天最多发送一次。标题变量：{date}" },
};
const SECTION_HINT: Record<SectionId, string> = {
  brief: "当天发布的日报",
  kol: "所选博主最近 7 天的最新视频及其提到的股票；不选则显示近 48 小时发过视频的所有博主",
  options: "最近一次期权异动的 AI 要点和候选合约",
  research: "近 7 天完成的个股 AI 研究",
  holdings: "新增的 13F 持仓披露",
};
const DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const STATUS: Record<string, string> = { sent: "已发送", skipped: "无内容，稍后重试", failed: "失败", awaiting_approval: "等待批准" };
const DRAFT_STATUS: Record<Draft["status"], string> = { pending: "待批准", sent: "已发送", rejected: "已驳回", failed: "发送失败" };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "请求失败");
  return result;
}
const json = (method: string, body?: unknown): RequestInit => ({
  method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
});

/** Email HTML in a sandboxed frame sized to its content, so the admin sees exactly what recipients get. */
function EmailFrame({ html, title }: { html: string; title: string }) {
  const [height, setHeight] = useState(640);
  return (
    <iframe
      title={title}
      sandbox="allow-same-origin allow-popups"
      srcDoc={html}
      onLoad={(e) => {
        const doc = e.currentTarget.contentDocument;
        if (doc) setHeight(doc.documentElement.scrollHeight);
      }}
      style={{ height }}
      className="block w-full rounded-xl bg-white"
    />
  );
}

/** Toggle chips for the creators shown in the email; chosen order is the order in the email. */
function CreatorPicker({ creators, value, onChange }: { creators: Creator[]; value: string[]; onChange: (ids: string[]) => void }) {
  const names = new Map(creators.map((c) => [c.channel_id, c.channel_title]));
  return (
    <div className="space-y-2">
      <p className="text-[0.8125rem] text-muted-foreground">
        {value.length ? `已选 ${value.length} 位：${value.map((id) => names.get(id) ?? id).join("、")}` : "未选择，显示近 48 小时所有博主"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {creators.map((creator) => {
          const selected = value.includes(creator.channel_id);
          return (
            <Button
              key={creator.channel_id}
              type="button"
              variant="chip"
              size="chip"
              selected={selected}
              aria-pressed={selected}
              className="min-h-8 gap-1.5 px-2.5 text-[0.8125rem]"
              onClick={() => onChange(selected ? value.filter((id) => id !== creator.channel_id) : [...value, creator.channel_id])}
            >
              {creator.avatar_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creator.avatar_url} alt="" referrerPolicy="no-referrer" className="h-5 w-5 rounded-full" />
              )}
              {creator.channel_title}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

const parseEmails = (text: string) => text.split(/[\s,;，；]+/).map((x) => x.trim()).filter(Boolean);

function Card({ initial, creators, counts, onSaved }: { initial: EmailSetting; creators: Creator[]; counts: AudienceCounts | null; onSaved: () => void }) {
  const [form, setForm] = useState(initial);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showDraft, setShowDraft] = useState(false);
  const set = <K extends keyof EmailSetting>(key: K, value: EmailSetting[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setContent = (patch: Partial<Content>) => setForm((f) => ({ ...f, content: { ...f.content, ...patch } }));
  const setSection = (id: SectionId, patch: Partial<Section>) =>
    setContent({ sections: form.content.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const [emailText, setEmailText] = useState(initial.content.delivery.emails.join("\n"));
  const delivery = form.content.delivery;
  const setDelivery = (patch: Partial<Delivery>) => setContent({ delivery: { ...delivery, ...patch } });
  const audienceSize = delivery.audience === "custom" ? delivery.emails.length : counts?.[delivery.audience] ?? null;
  const base = `/api/admin/email-settings?kind=${form.kind}`;
  // The timezone field may hold a half-typed value; fall back to the saved one.
  const today = (() => {
    for (const timeZone of [form.timezone, initial.timezone]) {
      try { return new Date().toLocaleDateString("en-CA", { timeZone }); } catch { /* try the next */ }
    }
    return new Date().toLocaleDateString("en-CA");
  })();
  const sentToday = draft?.status === "sent" && draft.send_date === today;
  const field = "h-9 !text-[0.8125rem]";

  const loadDraft = useCallback(async () => {
    try { setDraft((await request<{ draft: Draft | null }>(`${base}&action=draft`)).draft); } catch { /* the panel shows nothing */ }
  }, [base]);
  useEffect(() => { void loadDraft(); }, [loadDraft]);

  // Live preview of unsaved content; debounced so typing does not query the backend on every key.
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setPreview(await request<Preview>(`${base}&action=preview`, json("POST", { content: form.content })));
        setPreviewError("");
      } catch (e) { setPreviewError(e instanceof Error ? e.message : "预览失败"); }
    }, 600);
    return () => clearTimeout(timer);
  }, [base, form.content]);

  async function run(action: () => Promise<string>) {
    setBusy(true); setMessage("");
    try { setMessage(await action()); } catch (e) { setMessage(e instanceof Error ? e.message : "操作失败"); }
    finally { setBusy(false); }
  }
  const save = () => run(async () => {
    const { enabled, send_time, timezone, weekdays, from_name, from_email, reply_to, subject_template, content } = form;
    await request(base, json("PUT", { enabled, send_time, timezone, weekdays, from_name, from_email, reply_to, subject_template, content }));
    onSaved();
    return "已保存";
  });
  const sendTest = () => run(async () => {
    const r = await request<{ sent: number; skipped: string | null }>(`${base}&action=test`, json("POST", { to: testTo }));
    return r.skipped ? r.skipped : `测试邮件已发送至 ${testTo}`;
  });
  const regenerate = () => run(async () => {
    setDraft((await request<{ draft: Draft }>(`${base}&action=draft`, json("POST"))).draft);
    setShowDraft(true);
    return "已按已保存的内容生成今天的草稿";
  });
  const sendNow = () => run(async () => {
    if (!window.confirm(`按已保存的内容和收件人，立即发送给 ${audienceSize ?? "?"} 人？每种邮件每天只能发送一次。`)) return "";
    const r = await request<{ sent: number }>(`${base}&action=send`, json("POST"));
    await loadDraft();
    onSaved();
    return `已发送给 ${r.sent} 人`;
  });
  const decide = (action: "approve" | "reject") => run(async () => {
    if (!draft) return "";
    if (action === "approve" && !window.confirm(`确定把「${draft.subject}」发送给 ${audienceSize ?? "?"} 人？`)) return "";
    const r = await request<{ sent?: number }>(`/api/admin/email-settings?action=${action}&draft=${draft.id}`, json("POST"));
    await loadDraft();
    onSaved();
    return action === "approve" ? `已发送给 ${r.sent ?? 0} 人` : "已驳回";
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
        <SettingsRow label="发送时间" input><Input type="time" shape="default" className={field} value={form.send_time} onChange={(e) => set("send_time", e.target.value)} /></SettingsRow>
        <SettingsRow label="时区" input><Input shape="default" className={field} value={form.timezone} onChange={(e) => set("timezone", e.target.value)} /></SettingsRow>
        <SettingsRow label="发送日">
          <div className="flex flex-wrap justify-end gap-x-2.5 gap-y-1 text-[0.8125rem] text-foreground">
            {DAYS.map((label, day) => (
              <label key={day} className="flex items-center gap-1.5">
                <input type="checkbox" checked={form.weekdays.includes(day)} onChange={(e) => set("weekdays", e.target.checked ? [...form.weekdays, day].sort() : form.weekdays.filter((d) => d !== day))} />{label}
              </label>
            ))}
          </div>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup label="内容">
        <SettingsRow label="头图" input>
          <Input type="url" shape="default" className={field} placeholder="https://…/banner.png" value={form.content.hero_image_url} onChange={(e) => setContent({ hero_image_url: e.target.value })} />
        </SettingsRow>
        <SettingsRow label="导语" stacked>
          <Textarea rows={3} className="!text-[0.8125rem]" placeholder="写在邮件开头的一段话，可留空" value={form.content.intro} onChange={(e) => setContent({ intro: e.target.value })} />
        </SettingsRow>
        {form.content.sections.map((section) => (
          <SettingsRow
            key={section.id}
            stacked
            label={
              <span className="flex w-full items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  {section.title}
                  <InfoTip label={section.title}>{SECTION_HINT[section.id]}</InfoTip>
                </span>
                <Switch checked={section.enabled} onCheckedChange={(v) => setSection(section.id, { enabled: v })} aria-label={`显示${section.title}`} />
              </span>
            }
          >
            {section.enabled && (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-[12rem_1fr]">
                  <Input shape="default" className={field} aria-label="板块标题" value={section.title} maxLength={60} onChange={(e) => setSection(section.id, { title: e.target.value })} />
                  <Input shape="default" className={field} aria-label="板块说明" placeholder="板块说明，可留空" value={section.note} maxLength={300} onChange={(e) => setSection(section.id, { note: e.target.value })} />
                </div>
                {section.id === "kol" && (
                  <CreatorPicker creators={creators} value={section.creators ?? []} onChange={(ids) => setSection("kol", { creators: ids })} />
                )}
              </div>
            )}
          </SettingsRow>
        ))}
      </SettingsGroup>

      <SettingsGroup label="发送方式">
        <SettingsRow label="定时发送">
          <SegmentedControl<Mode>
            label="定时发送方式"
            size="sm"
            value={delivery.mode}
            onChange={(mode) => setDelivery({ mode })}
            options={[{ value: "approval", label: "生成草稿待批准" }, { value: "auto", label: "自动发送" }]}
          />
        </SettingsRow>
        <SettingsRow label="收件人">
          <SegmentedControl<Audience>
            label="收件人"
            size="sm"
            value={delivery.audience}
            onChange={(audience) => setDelivery({ audience })}
            options={[
              { value: "subscribers", label: `订阅用户${counts ? ` ${counts.subscribers}` : ""}` },
              { value: "all", label: `全部用户${counts ? ` ${counts.all}` : ""}` },
              { value: "custom", label: "指定邮箱" },
            ]}
          />
        </SettingsRow>
        {delivery.audience === "all" && (
          <p className="px-4 py-3 text-[0.8125rem] text-warning">包含没有开启邮件通知的用户。</p>
        )}
        {delivery.audience === "custom" && (
          <SettingsRow label={`指定邮箱 · ${delivery.emails.length}`} stacked>
            <Textarea
              rows={3}
              className="!text-[0.8125rem]"
              placeholder="每行一个邮箱，也可以用逗号分隔"
              value={emailText}
              onChange={(e) => { setEmailText(e.target.value); setDelivery({ emails: parseEmails(e.target.value) }); }}
            />
          </SettingsRow>
        )}
      </SettingsGroup>

      <SettingsGroup label="发件">
        <SettingsRow label="发件人名称" input><Input shape="default" className={field} value={form.from_name} onChange={(e) => set("from_name", e.target.value)} /></SettingsRow>
        <SettingsRow label="发件邮箱" input><Input type="email" shape="default" className={field} value={form.from_email} onChange={(e) => set("from_email", e.target.value)} /></SettingsRow>
        <SettingsRow label="回复邮箱" input><Input type="email" shape="default" className={field} value={form.reply_to} onChange={(e) => set("reply_to", e.target.value)} /></SettingsRow>
        <SettingsRow label="标题模板" input><Input shape="default" className={field} value={form.subject_template} onChange={(e) => set("subject_template", e.target.value)} /></SettingsRow>
      </SettingsGroup>

      <SettingsGroup label="预览">
        <SettingsRow label="标题">
          <span className="truncate text-foreground">{preview?.subject ?? "—"}</span>
        </SettingsRow>
        <div className="bg-muted/40 p-3">
          {previewError
            ? <p role="alert" className="text-sm text-negative">{previewError}</p>
            : preview?.html
              ? <EmailFrame html={preview.html} title="邮件预览" />
              : <p className="text-sm text-muted-foreground">{preview?.empty ?? "正在生成预览…"}</p>}
        </div>
      </SettingsGroup>

      <SettingsGroup label="审核">
        <SettingsRow label="今日草稿">
          {draft
            ? <span className="truncate">{draft.send_date} · {DRAFT_STATUS[draft.status]}{draft.recipient_count != null && ` · ${draft.recipient_count} 人`}</span>
            : "—"}
        </SettingsRow>
        {draft?.error && <SettingsRow label="错误"><span className="text-negative">{draft.error}</span></SettingsRow>}
        {draft && (
          <SettingsRow label="草稿内容">
            <Button size="sm" variant="ghost" onClick={() => setShowDraft((v) => !v)}>{showDraft ? "收起草稿" : "查看草稿"}</Button>
          </SettingsRow>
        )}
        {draft && showDraft && <div className="bg-muted/40 p-3"><EmailFrame html={draft.html} title="待审核草稿" /></div>}
        <SettingsRow label="上次发送">
          {form.last_run_at ? new Date(form.last_run_at).toLocaleString() : "—"}
          {form.last_status && ` · ${STATUS[form.last_status] ?? form.last_status}`}
          {form.last_recipient_count != null && ` · ${form.last_recipient_count} 人`}
        </SettingsRow>
        {form.last_error && <SettingsRow label="错误"><span className="text-negative">{form.last_error}</span></SettingsRow>}
        <SettingsRow label="发送测试" input>
          <Input type="email" shape="default" placeholder="测试收件邮箱" className={field} value={testTo} onChange={(e) => setTestTo(e.target.value)} />
        </SettingsRow>
      </SettingsGroup>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {message && <span role="status" className="mr-auto text-sm text-muted-foreground">{message}</span>}
        <Button size="sm" variant="outline" disabled={busy || !testTo} onClick={() => void sendTest()}>发送测试</Button>
        <Button size="sm" variant="outline" disabled={busy || sentToday} onClick={() => void regenerate()}>重新生成草稿</Button>
        <Button size="sm" variant="outline" disabled={busy || sentToday} onClick={() => void sendNow()}>立即发送</Button>
        {draft?.status === "pending" && (
          <>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void decide("reject")}>驳回</Button>
            <Button size="sm" disabled={busy} onClick={() => void decide("approve")}>批准发送</Button>
          </>
        )}
        <Button size="sm" disabled={busy} onClick={() => void save()}>保存</Button>
      </div>
    </section>
  );
}

export default function EmailSettingsManager() {
  const [settings, setSettings] = useState<EmailSetting[] | null>(null);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [counts, setCounts] = useState<AudienceCounts | null>(null);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const r = await request<{ settings: EmailSetting[]; audience_counts: AudienceCounts; resend_configured: boolean }>("/api/admin/email-settings");
      setSettings(r.settings); setCounts(r.audience_counts); setConfigured(r.resend_configured);
    } catch (e) { setError(e instanceof Error ? e.message : "加载失败"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    request<{ creators: Creator[] }>("/api/admin/email-settings?action=creators").then((r) => setCreators(r.creators), () => {});
  }, []);

  if (error) return <p role="alert" className="text-sm text-negative">{error}</p>;
  if (!settings) return <p className="text-sm text-muted-foreground">加载中…</p>;
  return (
    <div className="space-y-8">
      {!configured && <p role="alert" className="rounded-3xl bg-negative/10 px-4 py-3 text-sm">后端未配置 RESEND_API_KEY，邮件不会发送。</p>}
      {settings.map((s) => <Card key={s.kind} initial={s} creators={creators} counts={counts} onSaved={() => void load()} />)}
    </div>
  );
}
