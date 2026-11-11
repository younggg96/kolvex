import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { View } from "react-native";
import { BriefArticle } from "../../components/BriefArticle";
import { BriefCalendar, BriefIconButton } from "../../components/BriefCalendar";
import { AuthGate, Filters, ResourceState } from "../../components/Content";
import { ArticleSkeleton, ChartSkeleton } from "../../components/Skeletons";
import { Button, Copy, Glass, Page, phone } from "../../components/UI";
import {
  briefReadingDate,
  editionNames,
  isWeekendBriefDate,
  shiftBriefDate,
  utcBriefDate,
} from "../../lib/briefDates";
import { brief } from "../../lib/contentApi";
import { BRIEF_TYPES, isBriefType } from "../../lib/contentTypes";
import { useText } from "../../lib/i18n";
import { useTheme } from "../../lib/theme";
import { useResource } from "../../lib/useResource";
import { useAuth } from "../../state/Auth";
import { usePreferences } from "../../state/Preferences";

const editions = BRIEF_TYPES.map((type) => [type, editionNames[type]] as const);
const skeleton = (
  <>
    <ChartSkeleton height={phone(210)} />
    <ArticleSkeleton />
  </>
);

export default function Briefs() {
  return (
    <AuthGate skeleton={skeleton} title="日报">
      <Library />
    </AuthGate>
  );
}

function Library() {
  const user = useAuth().session!.user.id;
  const { locale } = usePreferences();
  const t = useTheme();
  const text = useText();
  const params = useLocalSearchParams<{ date?: string; type?: string }>();
  const { date, type, today, id } = briefReadingDate(params);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const weekend = isWeekendBriefDate(date);
  const resource = useResource(`brief-edition:${user}:${id}`, (signal) =>
    brief(id, user, signal),
  );
  const label = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(utcBriefDate(date));

  function selectDate(value: string) {
    router.setParams({ date: value, type });
    setCalendarOpen(false);
  }

  return (
    <Page
      title="日报"
      hideTitle
      stickyHeader={
        <View style={{ marginHorizontal: 2, paddingTop: phone(8) }}>
          <Glass
            material
            style={{
              borderRadius: phone(28),
              padding: 8,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Button
              label={`选择简报日期：${label}`}
              icon={
                <SymbolView
                  name={{
                    ios: "calendar",
                    android: "calendar_today",
                    web: "calendar_today",
                  }}
                  size={phone(16)}
                  tintColor={t.text}
                />
              }
              trailingIcon={
                <SymbolView
                  name={{
                    ios: "chevron.down",
                    android: "expand_more",
                    web: "expand_more",
                  }}
                  size={phone(12)}
                  tintColor={t.text}
                />
              }
              onPress={() => setCalendarOpen(true)}
            >
              {label}
            </Button>
            <View style={{ flexDirection: "row", gap: phone(8) }}>
              <BriefIconButton
                label="前一天"
                icon={{
                  ios: "chevron.left",
                  android: "chevron_left",
                  web: "chevron_left",
                }}
                onPress={() => selectDate(shiftBriefDate(date, -1))}
              />
              <BriefIconButton
                label="后一天"
                icon={{
                  ios: "chevron.right",
                  android: "chevron_right",
                  web: "chevron_right",
                }}
                onPress={() => selectDate(shiftBriefDate(date, 1))}
              />
            </View>
          </Glass>
        </View>
      }
    >
      <View style={{ marginHorizontal: 2, marginTop: -phone(12), gap: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: phone(8),
          }}
        >
          {weekend ? (
            <View style={{ flex: 1, paddingVertical: phone(8), gap: phone(4) }}>
              <Copy size={18} bold>
                周末简报
              </Copy>
              <Copy size={12} muted>
                周末每天一篇，不分盘前、盘中或盘后
              </Copy>
            </View>
          ) : (
            <View style={{ flex: 1, minWidth: 0 }}>
              <Filters
                size="sm"
                values={editions}
                value={type}
                onChange={(value) => {
                  if (isBriefType(value))
                    router.setParams({ date, type: value });
                }}
              />
            </View>
          )}
          <BriefIconButton
            label="刷新"
            icon={{
              ios: "arrow.clockwise",
              android: "refresh",
              web: "refresh",
            }}
            onPress={resource.refresh}
            disabled={resource.loading}
            glass={false}
          />
        </View>
        <ResourceState skeleton={skeleton} resource={resource} />
        {resource.data === null && !resource.loading && !resource.error && (
          <View style={{ alignItems: "center", paddingVertical: phone(48) }}>
            <Copy
              size={20}
              bold
            >{`这一天的${text(weekend ? "周末简报" : editionNames[type])}尚未发布`}</Copy>
          </View>
        )}
        {!!resource.data && (
          <BriefArticle key={id} document={resource.data.payload} />
        )}
      </View>
      {calendarOpen && (
        <BriefCalendar
          user={user}
          value={date}
          today={today}
          onClose={() => setCalendarOpen(false)}
          onChange={selectDate}
        />
      )}
    </Page>
  );
}
