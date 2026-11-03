import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { completeAuth } from "../../lib/authFlow";
import { Page, Copy, Failure, Button } from "../../components/UI";
export default function Callback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    // Web previews return the code to their opener, which owns the ephemeral
    // PKCE verifier. The native callback exchanges in this app's secure store.
    if (
      Platform.OS === "web" &&
      WebBrowser.maybeCompleteAuthSession().type === "success"
    )
      return;
    if (!code) {
      return;
    }
    void completeAuth(code)
      .then((result) => {
        if (active) router.replace(result.recovery ? "/auth/recovery" : "/");
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [code]);
  return (
    <Page title="验证账户">
      {error || !code ? (
        <Failure message={error || "未收到登录凭据，请重新登录。"} />
      ) : (
        <Copy>正在验证此设备的登录请求…</Copy>
      )}
      <Button onPress={() => router.replace("/")}>返回</Button>
    </Page>
  );
}
