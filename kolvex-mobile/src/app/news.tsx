import { usePreferences } from "../state/Preferences";
import { CardsSkeleton } from "../components/Skeletons";
import { news } from "../lib/contentApi";
import { useResource } from "../lib/useResource";
import { ResourceState, SourceLink } from "../components/Content";
import { useNewsTranslations } from "../lib/useNewsTranslations";
import { Button, Copy, Glass, ListPage } from "../components/UI";
export default function News() {
  const { locale } = usePreferences();
  const resource = useResource("news", (signal) => news(signal));
  const rows = resource.data?.articles ?? [];
  const translated = useNewsTranslations(
    rows.filter((item) => !item.title_zh).map((item) => item.title),
    locale,
  );
  return (
    <ListPage
      title="新闻终端"
      subtitle="来自公开来源的延迟新闻。"
      items={rows}
      keyFor={(item) => item.id ?? item.uuid ?? item.link}
      onRefresh={resource.refresh}
      refreshing={resource.loading && !!resource.data}
      header={
        <>
          <ResourceState skeleton={<CardsSkeleton lines={[{ size: 12, width: "45%" }, { size: 16, width: "70%", lines: 2 }, { size: 14, width: "25%" }]} />} resource={resource} empty={false} message="" />
          {resource.data?.stale && (
            <Copy>当前显示缓存内容，数据源暂时不可用。可下拉刷新重试。</Copy>
          )}
          {resource.data?.fetched_at && (
            <Copy size={12} muted>
              获取于{" "}
              {new Date(resource.data.fetched_at).toLocaleString(
                locale === "en" ? "en-US" : "zh-CN",
              )}
            </Copy>
          )}
          {translated.pending > 0 && (
            <Copy size={12} muted>
              正在翻译标题…
            </Copy>
          )}
          {translated.failed > 0 && (
            <Button onPress={translated.retry}>
              部分标题翻译失败，显示原文。点击重试
            </Button>
          )}
        </>
      }
      empty={
        !resource.loading && !resource.error ? (
          <ResourceState skeleton={<CardsSkeleton lines={[{ size: 12, width: "45%" }, { size: 16, width: "70%", lines: 2 }, { size: 14, width: "25%" }]} />}
            resource={resource}
            empty
            message="连接后端后显示最新新闻。"
          />
        ) : undefined
      }
      renderItem={(item) => (
        <Glass style={{ padding: 20, gap: 12 }}>
          <Copy size={12} muted>
            {item.publisher || "原始来源"} ·{" "}
            {item.publish_time
              ? new Date(item.publish_time * 1000).toLocaleString(
                  locale === "en" ? "en-US" : "zh-CN",
                )
              : "时间未提供"}
          </Copy>
          <Copy bold localize={false}>
            {locale === "zh"
              ? item.title_zh || translated.title(item.title) || item.title
              : item.title}
          </Copy>
          <SourceLink url={item.link}>阅读原文 ↗</SourceLink>
        </Glass>
      )}
    />
  );
}
