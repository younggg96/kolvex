import { router } from "expo-router";
import { useAuth } from "../../state/Auth";
import { apiURL, demoMode } from "../../lib/config";
import { Button, Copy, Glass, Page, Section } from "../../components/UI";
export default function More() {
  const auth = useAuth();
  return (
    <Page title="更多" subtitle="你的研究空间。">
      <Glass style={{ padding: 20, gap: 12 }}>
        <Copy size={20} bold>
          {auth.session?.user.email || "访客模式"}
        </Copy>
        <Copy size={14} muted>
          {auth.session
            ? "使用现有账户的资料与云端自选。"
            : "登录后查看日报、投资组合和 AI 研究。"}
        </Copy>
        <Button onPress={() => router.push("/account")}>
          {auth.session ? "管理账户" : "登录 / 注册"}
        </Button>
      </Glass>
      <Section title="研究与阅读" />
      <Button onPress={() => router.push("/briefs")}>市场日报 →</Button>
      <Button onPress={() => router.push("/news")}>新闻终端 →</Button>
      <Button onPress={() => router.push("/chat")}>Ask Kolvex →</Button>
      <Button onPress={() => router.push("/portfolio")}>投资组合 →</Button>
      <Section title="显示与体验" />
      <Glass style={{ padding: 20, gap: 12 }}>
        <Copy bold>跟随系统外观</Copy>
        <Copy size={14} muted>
          适配浅色、深色和系统字号。开启减少透明度时使用实色表面。
        </Copy>
      </Glass>
      <Section title="数据连接" />
      <Glass style={{ padding: 20, gap: 12 }}>
        <Copy bold>{demoMode ? "行情演示模式" : "已配置 Kolvex API"}</Copy>
        <Copy size={14} muted>
          {demoMode ? "尚未配置 API 地址。" : apiURL}
        </Copy>
        <Copy size={14} muted>
          行情可能延迟，接口异常会提示重试。日报与研究保留原始资料及来源。
        </Copy>
      </Glass>
      <Copy size={12} muted>
        Kolvex · 0.2.0 · 原生移动客户端
      </Copy>
    </Page>
  );
}
