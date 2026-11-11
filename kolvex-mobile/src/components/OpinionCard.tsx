import { router } from "expo-router";
import { Glass, Copy, Button } from "./UI";
import { SourceLink } from "./Content";
import { useTheme } from "../lib/theme";
import type { Opinion } from "../lib/models";
const names = {
  bullish: "看多",
  bearish: "看空",
  neutral: "中性",
  mixed: "观点分歧",
};
export function OpinionCard({
  item,
  creatorLink = true,
  creatorTicker = false,
}: {
  item: Opinion;
  creatorLink?: boolean;
  /** Open the creator filtered to this card's stock, with other creators' views below. */
  creatorTicker?: boolean;
}) {
  const t = useTheme();
  return (
    <Glass style={{ padding: 12, gap: 12 }}>
      <Copy bold size={15} localize={false}>
        {item.ticker} · {item.channel_title || item.channel_id || "来源未提供"}
      </Copy>
      <Copy size={12} muted>
        {item.opinion_date}
      </Copy>
      <Copy
        size={14}
        color={
          item.sentiment === "bullish"
            ? t.accent
            : item.sentiment === "bearish"
              ? t.negative
              : t.secondary
        }
      >
        {names[item.sentiment]}
      </Copy>
      <Copy size={15} selectable>
        {item.summary || item.thesis || "暂无摘要"}
      </Copy>
      {!!item.thesis && !!item.summary && item.thesis !== item.summary && (
        <Copy size={15} selectable>
          {item.thesis}
        </Copy>
      )}
      {item.key_points?.map((point, i) => (
        <Copy key={i} size={14} localize={false}>
          • {point}
        </Copy>
      ))}
      {!!item.risks?.length && (
        <Copy size={14} muted>
          提到的风险：{item.risks.join("；")}
        </Copy>
      )}
      {creatorLink && item.channel_id && (
        <Button
          onPress={() =>
            router.push(
              `/creator/youtube/${encodeURIComponent(item.channel_id!)}${
                creatorTicker && item.ticker
                  ? `?ticker=${encodeURIComponent(item.ticker)}`
                  : ""
              }`,
            )
          }
        >
          创作者资料与历史
        </Button>
      )}
      {item.ticker && (
        <Button
          onPress={() =>
            router.push(`/stock/${encodeURIComponent(item.ticker)}`)
          }
        >
          查看 {item.ticker}
        </Button>
      )}
      {!!item.video_url && (
        <SourceLink url={item.video_url}>查看原视频 ↗</SourceLink>
      )}
    </Glass>
  );
}
