import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, View } from "react-native";
import { BriefArticle } from "../../../../components/BriefArticle";
import { AuthGate, ResourceState } from "../../../../components/Content";
import {
  ArticleSkeleton,
  ChartSkeleton,
} from "../../../../components/Skeletons";
import { Button, Copy, Page, phone } from "../../../../components/UI";
import { isBriefDate } from "../../../../lib/briefDates";
import { brief } from "../../../../lib/contentApi";
import { isBriefType } from "../../../../lib/contentTypes";
import { useText } from "../../../../lib/i18n";
import { useTheme } from "../../../../lib/theme";
import { useResource } from "../../../../lib/useResource";
import { useAuth } from "../../../../state/Auth";

const skeleton = (
  <>
    <ChartSkeleton height={phone(210)} />
    <ArticleSkeleton />
  </>
);

export default function Brief() {
  return (
    <AuthGate skeleton={skeleton} title="日报">
      <Reader />
    </AuthGate>
  );
}

function Reader() {
  const { id, date, type } = useLocalSearchParams<{
    id: string;
    date?: string;
    type?: string;
  }>();
  const user = useAuth().session!.user.id;
  const t = useTheme();
  const text = useText();
  const resource = useResource(`brief-edition:${user}:${id}`, (signal) =>
    brief(id, user, signal),
  );

  function back() {
    router.navigate({
      pathname: "/briefs",
      params: {
        date: isBriefDate(date) ? date : "",
        type: isBriefType(type) ? type : "",
      },
    });
  }

  return (
    <Page
      title="日报"
      hideTitle
      floatingHeader={
        <View
          style={{
            marginHorizontal: 2,
          }}
        >
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={text("返回日报")}
            onPress={back}
            hitSlop={4}
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              minHeight: phone(44),
              flexDirection: "row",
              alignItems: "center",
              gap: phone(8),
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "chevron_left",
                web: "chevron_left",
              }}
              size={phone(14)}
              tintColor={t.text}
            />
            <Copy size={14} bold>
              日报
            </Copy>
          </Pressable>
        </View>
      }
    >
      <View
        style={{ marginHorizontal: 2, marginTop: phone(4), gap: phone(40) }}
      >
        <ResourceState resource={resource} skeleton={skeleton} />
        {resource.data === null && !resource.loading && !resource.error && (
          <View style={{ gap: phone(8) }}>
            <Copy size={20} bold>
              未找到这期简报
            </Copy>
            <Copy size={14} muted>
              这期简报可能尚未导入，请返回列表查看其他期刊。
            </Copy>
          </View>
        )}
        {!!resource.data && (
          <BriefArticle key={id} document={resource.data.payload} />
        )}
        {(!!resource.data || resource.data === null) && (
          <View
            style={{
              borderTopWidth: StyleSheet.hairlineWidth,
              borderColor: t.border,
              paddingTop: phone(24),
            }}
          >
            <Button onPress={back}>返回日报</Button>
          </View>
        )}
      </View>
    </Page>
  );
}
