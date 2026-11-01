import { router } from "expo-router";
import { Button, Empty, Page } from "../components/UI";
export default function NotFound() {
  return (
    <Page title="页面未找到">
      <Empty
        title="这个链接暂时无法打开"
        message="返回行情，继续查看市场与股票。"
      />
      <Button onPress={() => router.replace("/")}>返回行情</Button>
    </Page>
  );
}
