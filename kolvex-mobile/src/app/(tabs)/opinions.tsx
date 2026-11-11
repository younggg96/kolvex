import { usePreferences } from "../../state/Preferences";
import { CardsSkeleton } from "../../components/Skeletons";
import { useState } from "react";
import { router } from "expo-router";
import { xPosts } from "../../lib/contentApi";
import { demoMode } from "../../lib/config";
import { isSymbol, number, percent } from "../../lib/models";
import { useResource } from "../../lib/useResource";
import {
  REDDIT_COMMUNITIES,
  mentionChange,
  redditRanking,
  selectRedditStocks,
  type RedditCommunity,
  type RedditSort,
} from "../../lib/reddit";
import { useWatchlist } from "../../state/Watchlist";
import { TranslatableText } from "../../components/Translate";
import { YouTubeOverview } from "../../components/YouTubeOverview";
import {
  Filters,
  Pager,
  ResourceState,
  SourceLink,
} from "../../components/Content";
import {
  Button,
  Copy,
  Failure,
  Glass,
  Page,
  Search,
} from "../../components/UI";
export default function Opinions() {
  const [source, setSource] = useState("youtube");
  const [revision, setRevision] = useState(0);
  return (
    <Page
      title="KOL 观点"
      hideTitle
      onRefresh={() => setRevision((v) => v + 1)}
    >
      <Filters
        values={[
          ["youtube", "YouTube"],
          ["reddit", "Reddit"],
          ["x", "X"],
        ]}
        value={source}
        onChange={setSource}
      />
      {source === "youtube" ? (
        <YouTubeOverview revision={revision} />
      ) : source === "x" ? (
        <XFeed revision={revision} />
      ) : (
        <Reddit revision={revision} />
      )}
    </Page>
  );
}
function XFeed({ revision }: { revision: number }) {
  const { locale } = usePreferences();
  const [page, setPage] = useState(1);
  const [input, setInput] = useState("");
  const [ticker, setTicker] = useState("");
  const resource = useResource(`x:${revision}:${page}:${ticker}`, (signal) =>
    xPosts(signal, (page - 1) * 20, ticker),
  );
  const rows = resource.data?.posts ?? [];
  const apply = () => {
    setTicker(input.trim().toUpperCase().replace(/^\$/, ""));
    setPage(1);
  };
  return (
    <>
      <Search
        placeholder="按股票代码筛选 X 原文"
        value={input}
        onChange={(v) => {
          setInput(v);
          if (!v.trim()) {
            setTicker("");
            setPage(1);
          }
        }}
        onSubmit={apply}
      />
      <Button onPress={apply}>按股票筛选</Button>
      <ResourceState
        skeleton={
          <CardsSkeleton
            lines={[
              { size: 16, width: "40%" },
              { size: 12, width: "30%" },
              { size: 16, width: "70%", lines: 3 },
            ]}
          />
        }
        resource={resource}
        empty={!rows.length}
        message="暂无匹配的 X 原文，试试其他股票或稍后刷新。"
      />
      {rows.map((item) => (
        <Glass key={item.id} style={{ padding: 20, gap: 12 }}>
          <Copy bold>{item.creator?.display_name || item.author_username}</Copy>
          <Copy size={12} muted>
            @{item.author_username} ·{" "}
            {new Date(item.published_at).toLocaleString(
              locale === "en" ? "en-US" : "zh-CN",
            )}
          </Copy>
          <TranslatableText text={item.text} />
          {item.quoted_texts?.map((text, i) => (
            <TranslatableText key={i} text={text} size={14} muted />
          ))}
          {item.truncated && (
            <Copy size={12} muted>
              采集文本可能不完整，请查看原文。
            </Copy>
          )}
          <Copy size={12} muted>
            {item.cashtags?.join(" · ")}
          </Copy>
          <SourceLink url={item.url}>查看 X 原文 ↗</SourceLink>
        </Glass>
      ))}
      <Pager
        page={page}
        hasMore={page * 20 < (resource.data?.total ?? 0)}
        loading={resource.loading}
        onChange={setPage}
      />
    </>
  );
}
function Reddit({ revision }: { revision: number }) {
  const { locale } = usePreferences();
  const [community, setCommunity] = useState<RedditCommunity>("all-stocks");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<RedditSort>("mentions");
  const [onlySaved, setOnlySaved] = useState(false);
  const list = useWatchlist();
  const resource = useResource(`reddit:${community}:${revision}`, (signal) =>
    demoMode
      ? Promise.resolve({ results: [], fetchedAt: "", community })
      : redditRanking(community, signal, revision > 0),
  );
  const rows = selectRedditStocks(
    resource.data?.results ?? [],
    query,
    sort,
    onlySaved ? list.symbols : undefined,
  );
  return (
    <>
      <Filters
        values={REDDIT_COMMUNITIES.map(
          (key) =>
            [key, key === "all-stocks" ? "全部社区" : `r/${key}`] as const,
        )}
        value={community}
        onChange={(v) => setCommunity(v as RedditCommunity)}
      />
      <Search
        placeholder="搜索讨论榜中的股票或公司"
        value={query}
        onChange={setQuery}
      />
      <Filters
        values={[
          ["mentions", "提及次数"],
          ["mentionChange", "讨论增幅"],
          ["rankChange", "排名上升"],
          ["upvotes", "赞同数"],
        ]}
        value={sort}
        onChange={(v) => setSort(v as RedditSort)}
      />
      <Button selected={onlySaved} onPress={() => setOnlySaved((v) => !v)}>
        仅看自选
      </Button>
      <Copy size={12} muted>
        ApeWisdom 当前前 100 名 · 过去 24 小时讨论活跃度，不代表投资情绪。
      </Copy>
      {resource.data?.fetchedAt && (
        <Copy size={12} muted>
          获取于{" "}
          {new Date(resource.data.fetchedAt).toLocaleString(
            locale === "en" ? "en-US" : "zh-CN",
          )}
        </Copy>
      )}
      {!!list.error && <Failure message={list.error} retry={list.refresh} />}
      <ResourceState
        skeleton={
          <CardsSkeleton
            lines={[
              { size: 20, width: "20%" },
              { size: 14, width: "40%" },
              { size: 16, width: "60%", lines: 2 },
            ]}
          />
        }
        resource={resource}
        empty={!rows.length}
        message="此社区榜单中没有匹配的股票。榜单外的自选仍会保留。"
      />
      {rows.map((item) => (
        <Glass key={item.ticker} style={{ padding: 20, gap: 12 }}>
          <Copy size={20} bold>
            #{item.rank} {item.ticker}
          </Copy>
          <Copy size={14} muted>
            {item.name}
          </Copy>
          <Copy>
            提及 {number(item.mentions, 0)} · 变化{" "}
            {percent(mentionChange(item))}
          </Copy>
          <Copy size={12} muted>
            赞同数 {number(item.upvotes, 0)} · 排名变化{" "}
            {item.previousRank === null ? "—" : item.previousRank - item.rank}
          </Copy>
          <Button
            disabled={!list.ready || list.pending}
            selected={list.symbols.includes(item.ticker)}
            onPress={() => list.toggle(item.ticker)}
          >
            {list.symbols.includes(item.ticker)
              ? "已加入自选 · 点击移除"
              : "加入自选"}
          </Button>
          {isSymbol(item.ticker) && (
            <Button
              onPress={() =>
                router.push(`/stock/${encodeURIComponent(item.ticker)}`)
              }
            >
              查看股票
            </Button>
          )}
        </Glass>
      ))}
      <SourceLink url="https://apewisdom.io/">数据来源与统计说明 ↗</SourceLink>
    </>
  );
}
