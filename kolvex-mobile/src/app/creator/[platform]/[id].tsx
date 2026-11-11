import { useState } from "react";
import { CardsSkeleton } from "../../../components/Skeletons";
import { useLocalSearchParams, router } from "expo-router";
import {
  authorPosts,
  catalogue,
  creatorProfile,
  xCreators,
} from "../../../lib/featureApi";
import { useResource } from "../../../lib/useResource";
import { XInsights } from "../../../components/XInsights";
import { isSymbol, number } from "../../../lib/models";
import { View } from "react-native";
import { Page, Glass, Copy, Button, Chip } from "../../../components/UI";
import {
  CoverageNote,
  OtherCreatorOpinions,
} from "../../../components/CreatorExtras";
import { Pager, ResourceState, SourceLink } from "../../../components/Content";
import { OpinionCard } from "../../../components/OpinionCard";
import { CreatorShare } from "../../../components/CreatorShare";
export default function CreatorDetail() {
  const p = useLocalSearchParams<{
    id: string;
    platform: string;
    ticker?: string;
  }>();
  const ticker =
    typeof p.ticker === "string" && isSymbol(p.ticker.toUpperCase())
      ? p.ticker.toUpperCase()
      : "";
  return p.platform === "youtube" ? (
    <YouTube key={`${p.id}:${ticker}`} id={p.id} ticker={ticker} />
  ) : p.platform === "x" ? (
    <XProfile id={p.id} />
  ) : (
    <Page title="创作者">
      <Copy>未知来源</Copy>
    </Page>
  );
}
function YouTube({ id, ticker }: { id: string; ticker: string }) {
  const [page, setPage] = useState(1);
  const profile = useResource(`creator:${id}`, (s) => creatorProfile(id, s));
  const history = useResource(`creator-history:${id}:${ticker}:${page}`, (s) =>
    catalogue(
      s,
      `&channel_id=${encodeURIComponent(id)}${ticker ? `&ticker=${encodeURIComponent(ticker)}` : ""}&offset=${(page - 1) * 20}`,
    ),
  );
  const c = profile.data;
  return (
    <Page
      title={c?.channel_title || "创作者资料"}
      titleLocalize={!c?.channel_title}
      onRefresh={() => {
        profile.refresh();
        history.refresh();
      }}
      refreshing={profile.loading || history.loading}
    >
      <ResourceState
        skeleton={
          <CardsSkeleton
            count={1}
            lines={[
              { size: 16, width: "60%", lines: 3 },
              { size: 16, width: "40%" },
              { size: 16, width: "30%" },
            ]}
          />
        }
        resource={profile}
        empty={!c}
        message="资料暂不可用"
      />
      {c && (
        <Glass style={{ padding: 20, gap: 12 }}>
          <Copy localize={!c.description}>{c.description || "暂无简介"}</Copy>
          <Copy muted>
            {c.country || "地区未提供"} · 订阅{" "}
            {c.hidden_subscriber_count
              ? "未公开"
              : number(c.subscriber_count, 0)}{" "}
            · 视频 {number(c.video_count, 0)}
          </Copy>
          <Copy muted>
            {c.profile_status === "available"
              ? "公开频道资料"
              : "部分资料来自已导入内容"}
          </Copy>
          {!!c.channel_url && (
            <SourceLink url={c.channel_url}>打开频道</SourceLink>
          )}
          <CoverageNote channelId={id} titles />
          <CreatorShare creator={c} />
        </Glass>
      )}
      {!!ticker && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Chip selected onPress={() => {}}>
            {ticker}
          </Chip>
          <Button
            onPress={() =>
              router.replace(`/creator/youtube/${encodeURIComponent(id)}`)
            }
          >
            查看全部观点
          </Button>
        </View>
      )}
      <ResourceState
        skeleton={
          <CardsSkeleton
            lines={[
              { size: 16, width: "40%" },
              { size: 12, width: "50%" },
              { size: 16, width: "60%", lines: 3 },
            ]}
            buttons={1}
          />
        }
        resource={history}
        empty={!history.data?.latest.length}
        message="暂无观点"
      />
      {history.data?.latest.map((o) => (
        <OpinionCard key={o.id} item={o} creatorLink={false} />
      ))}
      <Pager
        page={page}
        hasMore={history.data?.pagination?.has_more ?? false}
        loading={history.loading}
        onChange={setPage}
      />
      {!!ticker && <OtherCreatorOpinions ticker={ticker} currentCreator={id} />}
    </Page>
  );
}
function XProfile({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const r = useResource(`x:${id}:${page}`, (s) => authorPosts(id, page, s));
  const profiles = useResource("x-profiles", xCreators);
  const c = profiles.data?.creators.find((x) => x.username === id);
  return (
    <Page title={c?.display_name || `@${id}`} titleLocalize={!c?.display_name}>
      <Copy localize={!c?.bio}>{c?.bio || "原文来自 X，观点保留来源。"}</Copy>
      <Copy muted>关注者 {number(c?.followers_count, 0)}</Copy>
      <XInsights author={id} />
      <ResourceState
        skeleton={
          <CardsSkeleton
            lines={[
              { size: 16, width: "30%" },
              { size: 16, width: "70%", lines: 3 },
            ]}
            buttons={1}
          />
        }
        resource={r}
        empty={!r.data?.posts.length}
        message="暂无原文"
      />
      {r.data?.posts.map((p) => (
        <Glass key={p.id} style={{ padding: 20, gap: 12 }}>
          <Copy muted>{p.published_at}</Copy>
          <Copy selectable>{p.text}</Copy>
          {p.quoted_texts?.map((text, i) => (
            <Copy key={i} muted>
              {text}
            </Copy>
          ))}
          {p.cashtags.map((t) => (
            <Button
              key={t}
              onPress={() => router.push(`/stock/${encodeURIComponent(t)}`)}
            >
              {t}
            </Button>
          ))}
          <SourceLink url={p.url}>查看原文</SourceLink>
        </Glass>
      ))}
      <Pager
        page={page}
        hasMore={page * 20 < (r.data?.total ?? 0)}
        loading={r.loading}
        onChange={setPage}
      />
    </Page>
  );
}
