import "server-only";
import { Resend } from "resend";
import { render } from "@react-email/render";
import BriefEmail from "@/emails/BriefEmail";
import { localizedBrief, type BriefLanguage, type DailyBrief } from "@/lib/dailyBriefs";
import { SITE_URL } from "@/lib/seo";

const API = process.env.NEXT_PUBLIC_BACKEND_API_URL || "http://localhost:8080";
const BATCH = 100; // Resend batch limit per call

export class EmailConfigError extends Error {}

function client() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new EmailConfigError("邮件服务未配置：请设置 RESEND_API_KEY 和 EMAIL_FROM。");
  return { resend: new Resend(key), from };
}

async function backend<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}/api/v1/admin/briefs${path}`, {
    ...init, cache: "no-store", signal: AbortSignal.timeout(25000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "后端请求失败");
  return data as T;
}

async function renderFor(brief: DailyBrief, language: BriefLanguage) {
  const view = localizedBrief(brief, language);
  const html = await render(BriefEmail({
    brief: view, language,
    readUrl: `${SITE_URL}/dashboard/briefs/${encodeURIComponent(brief.brief.id)}`,
    manageUrl: `${SITE_URL}/dashboard/settings`,
  }));
  return { subject: view.brief.headline, html };
}

const pickLanguage = (locale: string | null | undefined, fallback: BriefLanguage): BriefLanguage =>
  locale === "zh" || locale === "en" ? locale : fallback;

export async function sendBriefTest(briefId: string, token: string, to: string) {
  const { resend, from } = client();
  const { payload } = await backend<{ payload: DailyBrief }>(`/${encodeURIComponent(briefId)}`, token);
  const { subject, html } = await renderFor(payload, payload.language ?? "zh");
  const { error } = await resend.emails.send({ from, to, subject: `[测试] ${subject}`, html });
  if (error) throw new Error(error.message);
  return { sent: 1 };
}

export async function sendBriefToSubscribers(briefId: string, token: string) {
  const { resend, from } = client();
  const { payload } = await backend<{ payload: DailyBrief }>(`/${encodeURIComponent(briefId)}`, token);
  const original = payload.language ?? "zh";
  const { recipients } = await backend<{ recipients: { id: string; email: string; locale: string | null }[] }>(`/${encodeURIComponent(briefId)}/email-recipients`, token);

  const rendered = new Map<BriefLanguage, { subject: string; html: string }>();
  for (const lang of new Set(recipients.map(r => pickLanguage(r.locale, original)))) rendered.set(lang, await renderFor(payload, lang));

  let sent = 0, failed = 0;
  for (let i = 0; i < recipients.length; i += BATCH) {
    const chunk = recipients.slice(i, i + BATCH);
    const { data, error } = await resend.batch.send(chunk.map(r => {
      const mail = rendered.get(pickLanguage(r.locale, original))!;
      return { from, to: r.email, subject: mail.subject, html: mail.html };
    }));
    const ids = data?.data ?? [];
    const deliveries = chunk.map((r, index) => error || !ids[index]
      ? { user_id: r.id, status: "failed", error: error?.message ?? "no id returned" }
      : { user_id: r.id, status: "sent", provider_id: ids[index].id });
    await backend(`/${encodeURIComponent(briefId)}/email-deliveries`, token, { method: "POST", body: JSON.stringify({ deliveries }) });
    sent += deliveries.filter(d => d.status === "sent").length;
    failed += deliveries.filter(d => d.status === "failed").length;
  }
  return { sent, failed, total: recipients.length };
}
