import { router } from "expo-router";
import { useState } from "react";
import { Image, Linking, Pressable, StyleSheet, View } from "react-native";
import { editionNames, isWeekendBriefDate } from "../lib/briefDates";
import {
  localizedBrief,
  type BriefImage,
  type BriefItem,
  type BriefSection,
  type DailyBrief,
} from "../lib/contentTypes";
import { safeExternal } from "../lib/links";
import { isSymbolShape } from "../lib/stockMentions";
import { useTheme } from "../lib/theme";
import { usePreferences } from "../state/Preferences";
import { TextBody } from "./Content";
import { Button, Copy, Failure, Glass, phone } from "./UI";

const figure = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const impacts = [
  ["short_term", "短期影响"],
  ["positioning", "定位应对"],
  ["long_term", "长期影响"],
  ["price_range", "预计价格变动"],
] as const;

function Prose({ text }: { text: string }) {
  return <TextBody text={text} size={15} lineHeight={28} />;
}

function BriefSource({ href, label }: { href: string; label: string }) {
  const url = safeExternal(href);
  const [error, setError] = useState(false);
  return (
    <>
      <Copy
        size={12}
        muted
        localize={false}
        role={url ? "link" : undefined}
        onPress={
          url
            ? () => void Linking.openURL(url).catch(() => setError(true))
            : undefined
        }
      >
        {label}
      </Copy>
      {!!error && <Failure message="无法打开来源链接，请稍后重试。" />}
    </>
  );
}

function BriefFigure({ image }: { image: BriefImage }) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);
  const url = safeExternal(image.url);
  return (
    <Glass clear>
      <View style={[styles.image, { backgroundColor: t.wash }]}>
        {!!url && !failed ? (
          <Image
            accessibilityLabel={image.caption || "日报配图"}
            source={{ uri: url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setFailed(true)}
          />
        ) : (
          <Copy size={14} muted localize={false}>
            {image.caption}
          </Copy>
        )}
      </View>
      <View
        style={[
          styles.wrap,
          {
            justifyContent: "space-between",
            paddingHorizontal: phone(12),
            paddingVertical: phone(8),
          },
        ]}
      >
        <Copy size={12} muted localize={false}>
          {image.caption}
        </Copy>
        {!!image.credit && (
          <BriefSource href={image.source_page} label={image.credit} />
        )}
      </View>
    </Glass>
  );
}

function BriefImpact({
  label,
  text,
  initiallyOpen,
}: {
  label: string;
  text: string;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <Glass style={{ padding: 16, gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        hitSlop={6}
      >
        <Copy size={14} bold>
          {open ? "▾ " : "▸ "}
          {label}
        </Copy>
      </Pressable>
      {open && <Prose text={text} />}
    </Glass>
  );
}

function BriefStory({ item }: { item: BriefItem }) {
  return (
    <Glass clear style={{ padding: 16, gap: 20 }}>
      {!!item.image && <BriefFigure image={item.image} />}
      <View style={styles.group}>
        {!!item.kicker && (
          <Copy size={12} muted localize={false}>
            {item.kicker}
          </Copy>
        )}
        {!!item.time_pt && (
          <Copy size={14} muted localize={false}>
            {item.time_pt} PT
          </Copy>
        )}
        <Copy size={20} lineHeight={32} bold localize={false}>
          {item.title}
        </Copy>
        {!!item.summary && <Prose text={item.summary} />}
        {!!item.detail && <Prose text={item.detail} />}
      </View>
      {item.checklist.length > 0 && (
        <View style={{ gap: phone(8) }}>
          {item.checklist.map((text, index) => (
            <Copy key={index} size={14} lineHeight={24} localize={false}>
              □ {text}
            </Copy>
          ))}
        </View>
      )}
      {item.key_stats.length > 0 && (
        <View style={[styles.wrap, { gap: phone(12) }]}>
          {item.key_stats.map((stat, index) => (
            <Glass
              key={index}
              style={{
                flexBasis: "48%",
                flexGrow: 1,
                minWidth: 0,
                padding: 12,
                gap: 4,
              }}
            >
              <Copy size={12} muted localize={false}>
                {stat.label}
              </Copy>
              <Copy size={18} bold localize={false}>
                {stat.value}
              </Copy>
            </Glass>
          ))}
        </View>
      )}
      {!!item.impact && (
        <View style={styles.group}>
          {impacts.map(([key, label]) => {
            const text = item.impact?.[key];
            return text ? (
              <BriefImpact
                key={key}
                label={label}
                text={text}
                initiallyOpen={key === "short_term" || key === "positioning"}
              />
            ) : null;
          })}
        </View>
      )}
      {item.sources.length > 0 && (
        <View style={[styles.wrap, { gap: phone(12) }]}>
          {item.sources.map((source, index) => {
            const url = safeExternal(source.url);
            return (
              <BriefSource
                key={index}
                href={source.url}
                label={
                  url ? `${source.name} ${new URL(url).hostname}` : source.name
                }
              />
            );
          })}
        </View>
      )}
      {item.related_tickers.length > 0 && (
        <View style={styles.wrap}>
          {item.related_tickers.map((ticker, index) =>
            isSymbolShape(ticker) ? (
              <Button
                key={index}
                onPress={() =>
                  router.push({
                    pathname: "/stock/[symbol]",
                    params: { symbol: ticker.toUpperCase() },
                  })
                }
              >
                {ticker}
              </Button>
            ) : (
              <Copy key={index} size={12} localize={false}>
                {ticker}
              </Copy>
            ),
          )}
        </View>
      )}
    </Glass>
  );
}

function BriefSectionContent({ section }: { section: BriefSection }) {
  const t = useTheme();
  const narrative = Array.isArray(section.narrative)
    ? section.narrative
    : [section.narrative];
  const marketSection = [
    "market_recap",
    "premarket",
    "intraday",
    "postmarket",
  ].includes(section.section_id);
  return (
    <View
      style={{
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: t.border,
        paddingTop: phone(24),
        gap: phone(20),
      }}
    >
      <View style={{ gap: phone(8) }}>
        <Copy size={20} bold localize={false}>
          {section.title}
        </Copy>
        {!!section.subtitle && (
          <Copy size={14} lineHeight={24} muted localize={false}>
            {section.subtitle}
          </Copy>
        )}
      </View>
      <View style={{ gap: phone(24) }}>
        {[...narrative, ...section.paragraphs]
          .filter(Boolean)
          .map((text, index) => (
            <Prose key={index} text={text} />
          ))}
        {marketSection && section.indices.length > 0 && (
          <View style={styles.group}>
            {section.indices.map((index, i) => (
              <Glass key={i} clear style={{ padding: 16 }}>
                <Copy bold localize={false}>
                  {index.name}
                </Copy>
                {index.close !== null && (
                  <View style={{ marginTop: phone(8) }}>
                    <Copy size={24} bold localize={false}>
                      {figure.format(index.close)}
                    </Copy>
                  </View>
                )}
                {index.change_pct !== null && (
                  <View style={styles.caption}>
                    <Copy
                      size={14}
                      localize={false}
                      color={
                        index.change_pct > 0
                          ? t.accent
                          : index.change_pct < 0
                            ? t.negative
                            : t.secondary
                      }
                    >
                      {`${index.change_pct > 0 ? "+" : ""}${index.change_pct.toFixed(2)}%`}
                    </Copy>
                  </View>
                )}
                {index.prev_close !== null && (
                  <View style={styles.caption}>
                    <Copy size={12} muted>
                      前收盘 {figure.format(index.prev_close)}
                    </Copy>
                  </View>
                )}
                {!!index.note && (
                  <View style={{ marginTop: phone(8) }}>
                    <Copy size={12} muted localize={false}>
                      {index.note}
                    </Copy>
                  </View>
                )}
              </Glass>
            ))}
          </View>
        )}
        {marketSection &&
          (
            [
              ["领涨", t.accent, section.movers_up],
              ["领跌", t.negative, section.movers_down],
            ] as const
          ).map(([label, color, items]) =>
            items.length ? (
              <View key={label} style={styles.group}>
                <Copy bold color={color}>
                  {label}
                </Copy>
                {items.map((item, index) => (
                  <View key={index}>
                    <Copy bold localize={false}>
                      {item.name}
                    </Copy>
                    <Prose text={item.detail} />
                  </View>
                ))}
              </View>
            ) : null,
          )}
        {marketSection && section.commodities.length > 0 && (
          <View style={styles.wrap}>
            {section.commodities.map((item, index) => (
              <Glass
                key={index}
                style={{ paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Copy size={14} lineHeight={24} localize={false}>
                  {item.name} {item.detail}
                </Copy>
              </Glass>
            ))}
          </View>
        )}
        {section.items.map((item, index) => (
          <BriefStory key={index} item={item} />
        ))}
        {!!section.takeaway && (
          <View
            style={{
              borderLeftWidth: phone(2),
              borderColor: t.accent,
              paddingLeft: phone(20),
            }}
          >
            <Copy size={20} lineHeight={36} bold localize={false}>
              {section.takeaway}
            </Copy>
          </View>
        )}
        {!!section.strategy_line && (
          <Glass style={{ padding: 16 }}>
            <Prose text={section.strategy_line} />
          </Glass>
        )}
        {section.events.length > 0 && (
          <View
            style={{
              borderLeftWidth: StyleSheet.hairlineWidth,
              borderColor: t.border,
              paddingLeft: phone(20),
              gap: phone(24),
            }}
          >
            {section.events.map((event, index) => (
              <View key={index} style={styles.wrapColumn}>
                <Copy size={12} muted localize={false}>
                  {event.date_label}
                </Copy>
                <Copy bold localize={false}>
                  {event.title}
                </Copy>
                <Prose text={event.detail} />
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export function BriefArticle({ document }: { document: DailyBrief }) {
  const t = useTheme();
  const { locale } = usePreferences();
  const { brief, sections, disclaimer } = localizedBrief(document, locale);
  const weekend = isWeekendBriefDate(brief.date);
  return (
    <View style={{ gap: phone(40) }}>
      <View style={{ gap: phone(16) }}>
        {!!brief.hero_image && (
          <BriefFigure key={brief.hero_image.url} image={brief.hero_image} />
        )}
        <View style={styles.wrap}>
          <Copy size={12} muted localize={false}>
            {brief.date}
          </Copy>
          <Copy size={12} muted>
            {weekend || brief.market_status === "weekend"
              ? "周末·周复盘"
              : "交易日"}
          </Copy>
          <Copy size={12} muted>
            {weekend ? "周末简报" : editionNames[brief.type]}
          </Copy>
        </View>
        <Copy size={14} bold localize={false}>
          {brief.title}
        </Copy>
        <Copy size={24} lineHeight={30} bold localize={false}>
          {brief.headline}
        </Copy>
        {!!brief.subtitle && (
          <Copy size={14} lineHeight={24} muted localize={false}>
            {brief.subtitle}
          </Copy>
        )}
        {!!brief.generated_at_pt && (
          <Copy size={12} muted>
            生成时间（美西）： {brief.generated_at_pt}
          </Copy>
        )}
      </View>
      {[...sections]
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <BriefSectionContent key={section.section_id} section={section} />
        ))}
      {!!disclaimer && (
        <View
          style={{
            borderTopWidth: StyleSheet.hairlineWidth,
            borderColor: t.border,
            paddingTop: phone(20),
          }}
        >
          <Copy size={12} lineHeight={24} muted localize={false}>
            {disclaimer}
          </Copy>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    aspectRatio: 16 / 9,
    justifyContent: "center",
    alignItems: "center",
  },
  group: { gap: phone(12) },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: phone(8) },
  wrapColumn: { gap: phone(8) },
  caption: { marginTop: phone(4) },
});
