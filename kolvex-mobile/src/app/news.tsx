import { usePreferences } from "../state/Preferences";
import { news } from "../lib/contentApi";
import { useResource } from "../lib/useResource";
import { ResourceState, SourceLink } from "../components/Content";
import { Copy, Glass, ListPage } from "../components/UI";
export default function News() {
  const { locale } = usePreferences();
  const resource = useResource("news", (signal) => news(signal));
  const rows = resource.data?.articles ?? [];
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
          <ResourceState resource={resource} empty={false} message="" />
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
        </>
      }
      empty={
        !resource.loading && !resource.error ? (
          <ResourceState
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
            {locale === "zh" ? item.title_zh || item.title : item.title}
          </Copy>
          <SourceLink url={item.link}>阅读原文 ↗</SourceLink>
        </Glass>
      )}
    />
  );
}
