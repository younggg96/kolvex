import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { BriefLanguage, DailyBrief } from "@/lib/dailyBriefs";

const COPY = {
  zh: { read: "阅读全文", manage: "管理邮件订阅", why: "你收到这封邮件，是因为在 Kolvex 开启了每日简报邮件。", indices: "主要指数", points: "要点" },
  en: { read: "Read the full brief", manage: "Manage email settings", why: "You get this email because you turned on daily brief emails at Kolvex.", indices: "Indices", points: "Highlights" },
} as const;

const pct = (value: number | null) => (value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`);

export interface BriefEmailProps {
  brief: DailyBrief;
  language: BriefLanguage;
  readUrl: string;
  manageUrl: string;
}

export default function BriefEmail({ brief, language, readUrl, manageUrl }: BriefEmailProps) {
  const t = COPY[language];
  const indices = brief.sections.flatMap(s => s.indices).slice(0, 6);
  const points = brief.sections.filter(s => s.takeaway).slice(0, 4);
  return (
    <Html lang={language}>
      <Head />
      <Preview>{brief.brief.headline}</Preview>
      <Body style={{ backgroundColor: "#f6f7f9", fontFamily: "-apple-system, 'Segoe UI', 'PingFang SC', sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: 8, maxWidth: 560, padding: "28px 28px 20px" }}>
          <Text style={{ color: "#6b7280", fontSize: 12, margin: 0 }}>{brief.brief.title} · {brief.brief.date}</Text>
          <Heading as="h1" style={{ color: "#111827", fontSize: 22, lineHeight: "30px", margin: "8px 0 4px" }}>{brief.brief.headline}</Heading>
          {brief.brief.subtitle && <Text style={{ color: "#4b5563", fontSize: 14, margin: "0 0 12px" }}>{brief.brief.subtitle}</Text>}

          {indices.length > 0 && (
            <Section style={{ margin: "16px 0" }}>
              <Text style={{ color: "#111827", fontSize: 13, fontWeight: 600, margin: "0 0 6px" }}>{t.indices}</Text>
              {indices.map(item => (
                <Text key={item.name} style={{ color: "#374151", fontSize: 14, lineHeight: "22px", margin: 0 }}>
                  {item.name}　<span style={{ color: (item.change_pct ?? 0) >= 0 ? "#15803d" : "#b91c1c", fontWeight: 600 }}>{pct(item.change_pct)}</span>
                </Text>
              ))}
            </Section>
          )}

          {points.length > 0 && (
            <Section style={{ margin: "16px 0" }}>
              <Text style={{ color: "#111827", fontSize: 13, fontWeight: 600, margin: "0 0 6px" }}>{t.points}</Text>
              {points.map(section => (
                <Text key={section.section_id} style={{ color: "#374151", fontSize: 14, lineHeight: "22px", margin: "0 0 8px" }}>
                  <strong>{section.title}</strong>：{section.takeaway}
                </Text>
              ))}
            </Section>
          )}

          <Button href={readUrl} style={{ backgroundColor: "#111827", borderRadius: 6, color: "#ffffff", fontSize: 14, padding: "10px 18px", textDecoration: "none" }}>{t.read}</Button>

          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0 12px" }} />
          {brief.disclaimer && <Text style={{ color: "#9ca3af", fontSize: 11, lineHeight: "16px", margin: "0 0 8px" }}>{brief.disclaimer}</Text>}
          <Text style={{ color: "#9ca3af", fontSize: 11, lineHeight: "16px", margin: 0 }}>
            {t.why} <Link href={manageUrl} style={{ color: "#6b7280" }}>{t.manage}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
