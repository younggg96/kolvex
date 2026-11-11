import { usePreferences } from "../state/Preferences";
import { CardsSkeleton } from "./Skeletons";
import { apiRequest } from "../lib/http";
import { useResource } from "../lib/useResource";
import { Glass, Copy, Section } from "./UI";
import { ResourceState, SourceLink } from "./Content";
export function XInsights({ author }: { author: string }) {
  const { locale } = usePreferences();
  const r = useResource(`x-insights:${author}`, (signal) =>
    apiRequest<{
      generated_at: string;
      summaries: {
        username: string;
        coverage_start: string;
        coverage_end: string;
        content: {
          zh: { headline: string; basis: string; risks: string };
          en?: { headline: string; basis: string; risks: string };
        };
        sources: { id: string; url: string }[];
      }[];
    }>(`/x-content/summaries?author=${encodeURIComponent(author)}`, { signal }),
  );
  return (
    <>
      <Section title="已保存的博主观点摘要" />
      <Copy muted size={12}>
        仅覆盖已导入的部分原帖，不是博主的完整观点。读取不会调用模型。生成于{" "}
        {r.data?.generated_at || "未提供"}
      </Copy>
      <ResourceState
        skeleton={
          <CardsSkeleton
            count={2}
            lines={[
              { size: 16, width: "50%" },
              { size: 16, width: "70%", lines: 2 },
              { size: 16, width: "60%", lines: 2 },
              { size: 12, width: "40%" },
            ]}
            padding={16}
          />
        }
        resource={r}
        empty={!r.data?.summaries.length}
        message="此博主暂无带完整来源的摘要。"
      />
      {r.data?.summaries.map((s, i) => (
        <Glass key={i} style={{ padding: 16, gap: 12 }}>
          <Copy bold localize={false}>
            {(s.content[locale] || s.content.zh).headline}
          </Copy>
          <Copy localize={false}>
            {(s.content[locale] || s.content.zh).basis}
          </Copy>
          <Copy muted>注意：{(s.content[locale] || s.content.zh).risks}</Copy>
          <Copy size={12} muted>
            {s.coverage_start} — {s.coverage_end}
          </Copy>
          {s.sources.map((p, i) => (
            <SourceLink key={p.id} url={p.url}>
              依据原帖 {i + 1}
            </SourceLink>
          ))}
        </Glass>
      ))}
    </>
  );
}
