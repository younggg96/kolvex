import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../state/Auth";
import { brief } from "../../lib/contentApi";
import { useResource } from "../../lib/useResource";
import {
  AuthGate,
  EditorialImage,
  ResourceState,
  SourceLink,
  TextBody,
} from "../../components/Content";
import { Copy, Glass, Page, Section } from "../../components/UI";
import { number, percent } from "../../lib/models";
import { briefNames, localizedBrief } from "../../lib/contentTypes";
export default function Brief() {
  return (
    <AuthGate title="日报">
      <Reader />
    </AuthGate>
  );
}
function Reader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth().session!.user.id;
  const resource = useResource(`${user}:${id}`, (signal) =>
    brief(id, user, signal),
  );
  const doc = resource.data?.payload
    ? localizedBrief(resource.data.payload, "zh")
    : undefined;
  return (
    <Page
      title={doc?.brief.title ?? "日报"}
      subtitle={
        doc
          ? `${doc.brief.date} · ${briefNames[doc.brief.type]} · 太平洋时间`
          : undefined
      }
      onRefresh={resource.refresh}
      refreshing={resource.loading && !!doc}
    >
      <ResourceState
        resource={resource}
        empty={!doc}
        message="这篇日报尚不可用。"
      />
      {doc && (
        <>
          {doc.brief.hero_image && (
            <EditorialImage image={doc.brief.hero_image} />
          )}
          <Copy size={24} bold>
            {doc.brief.headline}
          </Copy>
          {!!doc.brief.subtitle && <Copy muted>{doc.brief.subtitle}</Copy>}
          {[...doc.sections]
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <Glass key={section.section_id} style={{ padding: 20, gap: 16 }}>
                <Section title={section.title} note={section.subtitle} />
                {section.narrative && (
                  <TextBody
                    text={
                      Array.isArray(section.narrative)
                        ? section.narrative.join("\n\n")
                        : section.narrative
                    }
                  />
                )}
                {section.paragraphs.map((text, i) => (
                  <TextBody key={i} text={text} />
                ))}
                {section.indices.map((item, i) => (
                  <Copy key={i}>
                    {item.name} · {number(item.close)} ·{" "}
                    {percent(item.change_pct)}
                    {item.note ? ` · ${item.note}` : ""}
                  </Copy>
                ))}
                {[
                  ...section.movers_up,
                  ...section.movers_down,
                  ...section.commodities,
                ].map((item, i) => (
                  <Copy key={i}>
                    {item.name} · {item.detail}
                  </Copy>
                ))}
                {section.items.map((item, i) => (
                  <Glass key={i} style={{ padding: 16, gap: 12 }}>
                    <Copy size={20} bold>
                      {item.title}
                    </Copy>
                    {item.image && <EditorialImage image={item.image} />}
                    {!!item.kicker && (
                      <Copy size={12} muted>
                        {item.kicker}
                      </Copy>
                    )}
                    {!!item.time_pt && (
                      <Copy size={12} muted>
                        {item.time_pt} PT
                      </Copy>
                    )}
                    {!!item.summary && <Copy>{item.summary}</Copy>}
                    {!!item.detail && <TextBody text={item.detail} />}
                    {item.key_stats.map((stat, j) => (
                      <Copy key={j}>
                        {stat.label} · {stat.value}
                      </Copy>
                    ))}
                    {item.impact &&
                      Object.entries(item.impact)
                        .filter(([, value]) => !!value)
                        .map(([key, value]) => (
                          <Copy key={key}>
                            {(
                              {
                                short_term: "短期影响",
                                long_term: "长期影响",
                                price_range: "价格区间",
                                positioning: "仓位观察",
                              } as Record<string, string>
                            )[key] ?? key}
                            ：{value}
                          </Copy>
                        ))}
                    {item.checklist.map((text, j) => (
                      <Copy key={j}>• {text}</Copy>
                    ))}
                    {!!item.related_tickers.length && (
                      <Copy size={12} muted>
                        {item.related_tickers.join(" · ")}
                      </Copy>
                    )}
                    {item.sources.map((source, j) => (
                      <SourceLink key={j} url={source.url}>
                        {source.name} ↗
                      </SourceLink>
                    ))}
                  </Glass>
                ))}
                {section.events.map((event, i) => (
                  <Copy key={i}>
                    {event.date_label} · {event.title}
                    {"\n"}
                    {event.detail}
                  </Copy>
                ))}
                {!!section.takeaway && <Copy bold>{section.takeaway}</Copy>}
                {!!section.strategy_line && (
                  <Copy>{section.strategy_line}</Copy>
                )}
              </Glass>
            ))}
          <Copy size={12} muted>
            {doc.disclaimer || "仅供信息参考，请核实原始资料。"}
          </Copy>
        </>
      )}
    </Page>
  );
}
