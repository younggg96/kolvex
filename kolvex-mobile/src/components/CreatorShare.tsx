import { useRef, useState, type ComponentRef } from "react";
import {
  Linking,
  Modal,
  Platform,
  ScrollView,
  Share,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import {
  creatorEmailLink,
  creatorShareContent,
  creatorSocialLinks,
  type CreatorShareIdentity,
} from "../lib/creatorSharing";
import { formatOpinionDate } from "../lib/opinionDates";
import { creatorLatestVideo } from "../lib/featureApi";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { ResourceState } from "./Content";
import { Button, Copy, Failure, Glass, Skeleton } from "./UI";
export function CreatorShare({ creator }: { creator: CreatorShareIdentity }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onPress={() => setOpen(true)}>分享创作者观点</Button>
      {open && (
        <Modal
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setOpen(false)}
        >
          <Sheet creator={creator} close={() => setOpen(false)} />
        </Modal>
      )}
    </>
  );
}
function Sheet({
  creator,
  close,
}: {
  creator: CreatorShareIdentity;
  close: () => void;
}) {
  const t = useTheme();
  const { locale } = usePreferences();
  const card = useRef<ComponentRef<typeof View>>(null);
  const [failed, setFailed] = useState<string>();
  const [busy, setBusy] = useState(false);
  const r = useResource(`creator-latest:${creator.channel_id}`, (signal) =>
    creatorLatestVideo(creator.channel_id, signal),
  );
  // The link stays shareable when the latest opinions could not be read.
  const content = creatorShareContent(creator, r.data ?? null, locale);
  const hasOpinions = !!r.data?.video && !!r.data.opinions.length;
  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => setFailed("无法打开链接，请稍后重试。"));
  };
  async function shareImage() {
    if (busy) return;
    setBusy(true);
    setFailed(undefined);
    try {
      if (!(await Sharing.isAvailableAsync()))
        throw new Error("系统分享不可用");
      const uri = await captureRef(card, { format: "png", quality: 1 });
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        UTI: "public.png",
        dialogTitle: content.title,
      });
    } catch {
      setFailed("图片生成失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: 24, gap: 16 }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Copy size={20} bold>
          分享创作者观点
        </Copy>
        <Button onPress={close}>关闭</Button>
      </View>
      <Button
        onPress={() =>
          void Share.share({
            title: content.title,
            message: content.text,
            url: content.url,
          }).catch(() => setFailed("此环境无法导出或分享，请稍后重试。"))
        }
      >
        系统分享
      </Button>
      {Platform.OS !== "web" && hasOpinions && (
        <Button disabled={busy} onPress={() => void shareImage()}>
          {busy ? "正在生成图片…" : "分享图片"}
        </Button>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {creatorSocialLinks(content).map((item) => (
          <Button key={item.name} onPress={() => openUrl(item.href)}>
            {item.name}
          </Button>
        ))}
        <Button onPress={() => openUrl(creatorEmailLink(content))}>邮件</Button>
      </View>
      {!!failed && <Failure message={failed} />}
      {r.loading ? (
        <Skeleton />
      ) : r.error ? (
        <Failure message="最新观点加载失败，仍可分享链接。" retry={r.refresh} />
      ) : !hasOpinions ? (
        <ResourceState
          resource={r}
          empty
          message="这位创作者暂无可分享的观点。"
        />
      ) : (
        <View
          ref={card}
          collapsable={false}
          style={{ backgroundColor: t.background, gap: 12, padding: 4 }}
        >
          <Glass style={{ padding: 20, gap: 12 }}>
            <Copy size={12} bold color={t.accent}>
              KOLVEX
            </Copy>
            <Copy bold localize={false}>
              {content.title}
            </Copy>
            <Copy size={12} muted localize={false}>
              {formatOpinionDate(
                r.data?.video?.opinion_date ||
                  r.data?.video?.video_published_at,
                locale === "zh" ? "zh-CN" : "en-US",
              )}
            </Copy>
            {r.data?.opinions.map((item) => (
              <View key={item.id} style={{ gap: 4 }}>
                <Copy bold size={14} localize={false}>
                  {item.ticker}
                </Copy>
                <Copy size={13} localize={false}>
                  {item.summary || item.thesis || ""}
                </Copy>
              </View>
            ))}
            <Copy size={12} muted localize={false}>
              {content.url}
            </Copy>
          </Glass>
        </View>
      )}
    </ScrollView>
  );
}
