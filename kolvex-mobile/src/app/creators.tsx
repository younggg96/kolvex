import { useState } from "react";
import { router } from "expo-router";
import { catalogue, videos, xCreators } from "../lib/featureApi";
import { useResource } from "../lib/useResource";
import { number } from "../lib/models";
import { Button, Copy, Glass, Page, Search } from "../components/UI";
import {
  Filters,
  Pager,
  ResourceState,
  SourceLink,
} from "../components/Content";
import { OpinionCard } from "../components/OpinionCard";
export default function Creators() {
  const [tab, setTab] = useState("youtube");
  return (
    <Page title="创作者与视频" subtitle="完整资料、来源和观点历史。">
      <Filters
        values={[
          ["youtube", "YouTube"],
          ["x", "X 博主"],
          ["videos", "视频历史"],
          ["stocks", "股票目录"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "x" ? (
        <XDirectory />
      ) : tab === "videos" ? (
        <VideoFeed />
      ) : (
        <Directory stocks={tab === "stocks"} />
      )}
    </Page>
  );
}
function Directory({ stocks }: { stocks: boolean }) {
  const r = useResource("catalogue", (signal) => catalogue(signal));
  const [search, setSearch] = useState("");
  const rows = (r.data?.creators ?? []).filter((c) =>
    `${c.channel_title} ${c.channel_id}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <Search
        value={search}
        onChange={setSearch}
        placeholder={stocks ? "搜索股票代码" : "搜索创作者"}
      />
      <ResourceState
        resource={r}
        empty={!r.data?.creators.length}
        message="暂无收录资料"
      />
      {stocks
        ? (r.data?.stocks ?? [])
            .filter((s) => s.ticker.includes(search.toUpperCase()))
            .map((s) => (
              <Glass key={s.ticker} style={{ padding: 20, gap: 12 }}>
                <Copy bold>{s.ticker}</Copy>
                <Copy muted>
                  {s.total_opinions} 条观点 · {s.creator_count} 位创作者
                </Copy>
                <Button onPress={() => router.push(`/stock/${s.ticker}`)}>
                  股票研究
                </Button>
              </Glass>
            ))
        : rows.map((c) => (
            <Glass key={c.channel_id} style={{ padding: 20, gap: 12 }}>
              <Copy bold localize={false}>
                {c.channel_title || c.channel_id}
              </Copy>
              <Copy muted>
                {number(c.total_opinions, 0)} 条观点 ·{" "}
                {c.top_tickers?.map((x) => x.ticker).join(" / ")}
              </Copy>
              <Button
                onPress={() =>
                  router.push(
                    `/creator/youtube/${encodeURIComponent(c.channel_id)}`,
                  )
                }
              >
                资料与完整历史
              </Button>
            </Glass>
          ))}
      {!r.loading && search && !rows.length && !stocks && (
        <Copy muted>没有匹配的创作者。</Copy>
      )}
    </>
  );
}
function XDirectory() {
  const r = useResource("x-creators", xCreators);
  return (
    <>
      <ResourceState
        resource={r}
        empty={!r.data?.creators.length}
        message="暂无 X 博主"
      />
      {r.data?.creators.map((c) => (
        <Glass key={c.username} style={{ padding: 20, gap: 12 }}>
          <Copy bold>
            {c.display_name} · @{c.username}
          </Copy>
          <Copy>{c.bio}</Copy>
          <Button
            onPress={() =>
              router.push(`/creator/x/${encodeURIComponent(c.username)}`)
            }
          >
            查看原文历史
          </Button>
        </Glass>
      ))}
    </>
  );
}
function VideoFeed() {
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string>();
  const r = useResource(`videos:${page}`, (s) => videos(page, s));
  return (
    <>
      <ResourceState
        resource={r}
        empty={!r.data?.videos.length}
        message="暂无视频"
      />
      {r.data?.videos.map((v) => (
        <Glass key={v.videoId} style={{ padding: 20, gap: 12 }}>
          <Copy bold>{v.video.video_title || v.videoId}</Copy>
          <Copy muted>
            {v.creator?.channel_title} ·{" "}
            {v.video.video_published_at?.slice(0, 10)}
          </Copy>
          {v.video_summary && <Copy selectable>{v.video_summary}</Copy>}
          {!!v.opinions.length && (
            <Button
              selected={open === v.videoId}
              onPress={() =>
                setOpen((value) =>
                  value === v.videoId ? undefined : v.videoId,
                )
              }
            >
              {open === v.videoId
                ? "收起股票观点"
                : `展开 ${v.opinions.length} 条股票观点`}
            </Button>
          )}
          {open === v.videoId &&
            v.opinions.map((o) => <OpinionCard key={o.id} item={o} />)}
          {!v.opinions.length && (
            <Copy muted>此视频没有已收录的个股观点。</Copy>
          )}
          {v.video.video_url && (
            <SourceLink url={v.video.video_url}>查看来源视频</SourceLink>
          )}
        </Glass>
      ))}
      <Pager
        page={page}
        hasMore={r.data?.pagination.has_more ?? false}
        loading={r.loading}
        onChange={setPage}
      />
    </>
  );
}
