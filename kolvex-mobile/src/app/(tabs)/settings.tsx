import { apiURL, demoMode } from "../../lib/api";
import { Copy, Glass, Page, Section } from "../../components/UI";
export default function Settings() {
  return (
    <Page title="设置" subtitle="Kolvex for mobile">
      <Section title="显示与体验" />
      <Glass style={{ padding: 20, gap: 12 }}>
        <Copy bold>跟随系统外观</Copy>
        <Copy size={14} muted>
          自动适配浅色与深色模式，使用系统字体和动态字号。减少透明度开启时使用实色背景。
        </Copy>
      </Glass>
      <Section title="数据连接" />
      <Glass style={{ padding: 20, gap: 12 }}>
        <Copy bold>{demoMode ? "当前使用演示数据" : "已配置 Kolvex API"}</Copy>
        <Copy size={14} muted>
          {demoMode
            ? "配置 EXPO_PUBLIC_API_URL 并重新启动应用即可连接后端。"
            : apiURL}
        </Copy>
        <Copy size={14} muted>
          行情由后端市场数据源提供。观点保留视频来源。接口不可用时显示错误，可手动重试。
        </Copy>
      </Glass>
      <Section title="关于此版本" />
      <Glass style={{ padding: 20, gap: 12 }}>
        <Copy bold>Kolvex · 0.1.0</Copy>
        <Copy size={14} muted>
          公开行情、创作者观点和本机自选。账户登录、券商连接及 AI
          对话尚未接入手机端。
        </Copy>
      </Glass>
    </Page>
  );
}
