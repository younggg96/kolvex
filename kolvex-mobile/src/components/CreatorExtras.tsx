// The Web's upload-coverage hints and OtherCreatorOpinions for YouTube creators.
import { useState } from "react";
import { View } from "react-native";
import { apiRequest } from "../lib/http";
import type { Opinion } from "../lib/models";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { OpinionCard } from "./OpinionCard";
import { CardsSkeleton } from "./Skeletons";
import { Button, Copy, Failure, LoadingStatus, Section } from "./UI";

type Coverage = {
  channel_id: string;
  status: string;
  since?: string | null;
  untracked_count: number;
  truncated: boolean;
  untracked: { title?: string | null }[];
};
const loadCoverage = (signal: AbortSignal) =>
  apiRequest<{ status: string; creators: Coverage[] }>(
    "/youtube-opinions/coverage",
    { signal, timeout: 30_000 },
  );

/** "N videos since the last update aren't tracked", only when the check succeeded. */
export function CoverageNote({
  channelId,
  titles = false,
}: {
  channelId?: string;
  /** Also list up to three untracked titles (the Web shows them as a hover hint). */
  titles?: boolean;
}) {
  const t = useTheme();
  const coverage = useResource("youtube-upload-coverage", loadCoverage, 30_000);
  const item = coverage.data?.creators.find((c) => c.channel_id === channelId);
  if (
    !item ||
    item.status !== "available" ||
    !item.since ||
    item.untracked_count === 0
  )
    return null;
  const hint = item.untracked
    .map((video) => video.title)
    .filter((title): title is string => Boolean(title))
    .slice(0, 3);
  return (
    <View style={{ gap: 2 }}>
      <Copy size={12} color="#C98A00">
        {item.truncated
          ? `上次更新后至少 ${item.untracked_count} 个视频未追踪`
          : `有 ${item.untracked_count} 个视频未追踪`}
      </Copy>
      {titles &&
        hint.map((title, i) => (
          <Copy key={i} size={12} muted lines={1} localize={false}>
            {`· ${title}`}
          </Copy>
        ))}
      {!titles && hint.length > 0 && (
        <Copy size={12} color={t.secondary} lines={1} localize={false}>
          {hint.join(" · ")}
        </Copy>
      )}
    </View>
  );
}

type StockOpinion = Opinion & {
  video_published_at?: string | null;
  created_at?: string;
};
/** Each other creator's latest view on the ticker, across all dates. */
export function OtherCreatorOpinions({
  ticker,
  currentCreator,
}: {
  ticker: string;
  currentCreator: string;
}) {
  const [visible, setVisible] = useState(3);
  const resource = useResource(`stock-opinions-all:${ticker}`, (signal) =>
    apiRequest<{ opinions?: StockOpinion[] }>(
      `/youtube-opinions/stocks/${encodeURIComponent(ticker)}`,
      { signal, timeout: 30_000 },
    ),
  );
  const latest = new Map<string, StockOpinion>();
  for (const opinion of [...(resource.data?.opinions ?? [])].sort(
    (a, b) =>
      b.opinion_date.localeCompare(a.opinion_date) ||
      (b.video_published_at || "").localeCompare(a.video_published_at || "") ||
      (b.created_at || "").localeCompare(a.created_at || "") ||
      a.id.localeCompare(b.id),
  ))
    if (
      opinion.channel_id &&
      opinion.channel_id !== currentCreator &&
      !latest.has(opinion.channel_id)
    )
      latest.set(opinion.channel_id, opinion);
  const opinions = [...latest.values()];
  return (
    <View style={{ gap: 12 }}>
      <Section
        title="其他博主的看法"
        note={`每位博主对 ${ticker} 的最新观点，涵盖全部时间。`}
      />
      {resource.loading && !resource.data ? (
        <LoadingStatus>
          <CardsSkeleton
            count={2}
            lines={[
              { size: 16, width: "40%" },
              { size: 14, lines: 3 },
            ]}
          />
        </LoadingStatus>
      ) : resource.error && !resource.data ? (
        <Failure message="其他博主的观点加载失败。" retry={resource.refresh} />
      ) : !opinions.length ? (
        <Copy size={14} muted>{`暂未收录其他博主对 ${ticker} 的观点。`}</Copy>
      ) : (
        <>
          {opinions.slice(0, visible).map((opinion) => (
            <OpinionCard key={opinion.id} item={opinion} creatorTicker />
          ))}
          {visible < opinions.length && (
            <Button onPress={() => setVisible((v) => v + 3)}>
              查看更多博主
            </Button>
          )}
        </>
      )}
    </View>
  );
}
