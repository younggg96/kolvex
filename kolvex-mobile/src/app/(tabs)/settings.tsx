import { router } from "expo-router";
import { useAuth } from "../../state/Auth";
import { profile } from "../../lib/contentApi";
import { demoMode, webURL } from "../../lib/config";
import { safeExternal } from "../../lib/links";
import { useResource } from "../../lib/useResource";
import { Linking } from "react-native";
import {
  Button,
  Copy,
  Glass,
  NavRow,
  Page,
  Section,
} from "../../components/UI";
const open = (url: string) => {
  const safe = safeExternal(url);
  if (safe) void Linking.openURL(safe).catch(() => undefined);
};
export default function More() {
  const auth = useAuth();
  const user = auth.session?.user.id;
  const account = useResource(`more-profile:${user}`, (signal) =>
    user ? profile(user, signal) : Promise.resolve(null),
  );
  return (
    <Page title="设置" subtitle="你的研究空间。">
      <Glass style={{ padding: 20, gap: 12 }}>
        <Copy size={20} bold localize={false}>
          {auth.session?.user.email ?? ""}
        </Copy>
        <Copy size={14} muted>
          使用现有账户的资料与云端自选。
        </Copy>
        <Button onPress={() => router.push("/account")}>管理账户</Button>
      </Glass>
      <Section title="研究与阅读" />
      <Glass>
        <NavRow title="市场日报" onPress={() => router.push("/briefs")} />
        <NavRow title="新闻终端" onPress={() => router.push("/news")} />
        <NavRow title="Ask Kolvex" onPress={() => router.push("/chat")} />
        <NavRow title="观点动态" onPress={() => router.push("/updates")} />
        <NavRow
          title="创作者、视频与股票目录"
          onPress={() => router.push("/creators")}
        />
        <NavRow title="宏观指标" onPress={() => router.push("/macro")} />
        <NavRow
          title="市场事件日历"
          last
          onPress={() => router.push("/calendar")}
        />
      </Glass>
      <Section title="显示与体验" />
      <Glass>
        <NavRow
          title="外观与模型密钥"
          note="适配浅色、深色和系统字号。开启减少透明度时使用实色表面。"
          last={!account.data?.is_admin}
          onPress={() => router.push("/preferences")}
        />
        {account.data?.is_admin && (
          <NavRow title="管理中心" last onPress={() => router.push("/admin")} />
        )}
      </Glass>
      <Section title="数据连接" />
      <Glass style={{ padding: 20, gap: 12 }}>
        <Copy bold>{demoMode ? "行情演示模式" : "已配置 Kolvex API"}</Copy>
        <Copy size={14} muted>
          行情可能延迟，接口异常会提示重试。日报与研究保留原始资料及来源。
        </Copy>
      </Glass>
      {webURL.startsWith("https://") && (
        <>
          <Section title="关于与支持" />
          <Glass>
            <NavRow
              title="隐私政策"
              onPress={() => open(`${webURL}/privacy`)}
            />
            <NavRow title="服务条款" onPress={() => open(`${webURL}/terms`)} />
            <NavRow
              title="联系 Kolvex"
              last
              onPress={() => open(`${webURL}/contact`)}
            />
          </Glass>
        </>
      )}
      <Copy size={12} muted>
        Kolvex · 0.4.0 · 原生移动客户端
      </Copy>
    </Page>
  );
}
