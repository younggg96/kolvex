import { useState } from "react";
import { Linking, View } from "react-native";
import { opinions, demoMode } from "../../lib/api";
import { useResource } from "../../lib/useResource";
import { useTheme } from "../../lib/theme";
import {
  Button,
  Copy,
  Empty,
  Failure,
  Glass,
  Page,
  Search,
  Skeleton,
  styles,
} from "../../components/UI";
const sentiment = {
  bullish: "看多",
  bearish: "看空",
  neutral: "中性",
  mixed: "观点分歧",
};
export default function Opinions() {
  const t = useTheme();
  const [query, setQuery] = useState("");
  const [linkError, setLinkError] = useState<string>();
  const resource = useResource("opinions", opinions);
  const items =
    resource.data?.latest.filter((item) =>
      `${item.ticker} ${item.channel_title ?? ""} ${item.summary ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    ) ?? [];
  async function openSource(url: string) {
    try {
      const parsed = new URL(url);
      if (
        parsed.protocol !== "https:" ||
        ![
          "youtube.com",
          "www.youtube.com",
          "m.youtube.com",
          "youtu.be",
        ].includes(parsed.hostname)
      )
        throw new Error();
      await Linking.openURL(parsed.toString());
      setLinkError(undefined);
    } catch {
      setLinkError("无法打开视频来源，请稍后重试。");
    }
  }
  return (
    <Page
      title="创作者观点"
      subtitle="谁在关注，为什么关注。"
      refreshing={resource.loading && !!resource.data}
      onRefresh={resource.refresh}
    >
      <Search value={query} onChange={setQuery} />
      {resource.error && (
        <Failure message={resource.error} retry={resource.refresh} />
      )}
      {linkError && <Failure message={linkError} />}
      {resource.loading && !resource.data ? (
        <Skeleton />
      ) : !resource.error && !items.length ? (
        <Empty
          title={query ? "没有匹配的观点" : "等待新的观点"}
          message={
            demoMode
              ? "连接 Kolvex 后端后，这里将展示创作者原话摘要、观点方向和视频来源。演示模式不生成虚构观点。"
              : query
                ? "试试其他股票代码或创作者名称。"
                : "当前没有可展示的观点，下拉刷新以重新获取。"
          }
        />
      ) : null}
      {items.map((item) => (
        <Glass key={item.id} style={{ padding: 20, gap: 12 }}>
          <View style={styles.row}>
            <Copy bold>{item.ticker}</Copy>
            <Copy
              size={12}
              color={item.sentiment === "bearish" ? t.negative : t.accent}
            >
              {sentiment[item.sentiment] ?? "未分类"}
            </Copy>
          </View>
          <Copy size={14} muted>
            {item.channel_title || "来源频道未提供"} · {item.opinion_date}
          </Copy>
          <Copy>{item.summary || item.thesis || "暂无摘要"}</Copy>
          {item.video_url && (
            <Button onPress={() => void openSource(item.video_url!)}>
              查看原视频 ↗
            </Button>
          )}
        </Glass>
      ))}
    </Page>
  );
}
