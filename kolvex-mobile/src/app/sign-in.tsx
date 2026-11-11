import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { supabase } from "../lib/supabase";
import { authConfigured } from "../lib/config";
import { oauth } from "../lib/authFlow";
import { useMutation } from "../lib/useMutation";
import { MutationStatus } from "../components/MutationStatus";
import { credentialsError } from "../lib/links";
import { useText } from "../lib/i18n";
import { Button, Copy, Empty, Failure, Glass } from "../components/UI";
import { Field, Filters } from "../components/Content";
import { useTheme } from "../lib/theme";

/** The Web's candlestick mark (public/logo.svg). */
function Logo() {
  return (
    <Svg width={30} height={30} viewBox="0 -960 960 960">
      <Path
        fill="#53d22d"
        d="M280-160v-90h-80v-460h80v-90h60v90h80v460h-80v90h-60Zm-20-150h100v-340H260v340Zm360 150v-210h-80v-260h80v-170h60v170h80v260h-80v210h-60Zm-20-270h100v-140H600v140Zm-290-50Zm340-20Z"
      />
    </Svg>
  );
}

/**
 * The Web's /auth screen on a phone: the Waylume light (a still frame, as the Web
 * shows phones) behind one glass card. No top bar, language or theme controls.
 */
export default function SignIn() {
  const t = useTheme();
  const text = useText();
  const insets = useSafeAreaInsets();
  const oauthAction = useMutation();
  const [mode, setMode] = useState("login");
  const [fieldError, setFieldError] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function submit() {
    if (lock.current || !supabase) return;
    const invalid = credentialsError(email, password, mode === "register");
    if (invalid) {
      setFieldError(
        invalid.includes("邮箱") ? { email: invalid } : { password: invalid },
      );
      return;
    }
    lock.current = true;
    setFieldError({});
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      // A Chinese keyboard types full-width punctuation ("！" for "!"). The password is tried
      // as typed first; only a rejected attempt retries with half-width characters.
      const halfWidth = password.replace(/[！-～]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0),
      );
      const signIn = (secret: string) =>
        supabase!.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password: secret,
        });
      let first = mode === "login" ? await signIn(password) : null;
      if (
        first?.error?.code === "invalid_credentials" &&
        halfWidth !== password
      )
        first = await signIn(halfWidth);
      const result =
        first ??
        (await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
        }));
      if (result.error) {
        // The code only, never the credentials: enough to tell a wrong password from a dead connection.
        if (__DEV__) {
          console.warn(
            `[sign-in] ${result.error.name} ${result.error.status ?? ""} ${result.error.code ?? ""}`,
          );
        }
        const message =
          result.error.code === "email_not_confirmed"
            ? "邮箱尚未验证，请先打开验证邮件。"
            : result.error.name === "AuthRetryableFetchError" ||
                !result.error.status
              ? "无法连接账户服务，请检查网络后重试。"
              : result.error.status === 429
                ? "请求较频繁，请稍后重试。"
                : mode === "login"
                  ? "登录失败，请检查邮箱与密码后重试。"
                  : "注册未完成，请检查邮箱和密码是否符合账户要求。";
        throw new Error(message);
      }
      if (!alive.current) return;
      setPassword("");
      if (result.data.session) router.replace("/");
      else
        setNotice("如该邮箱可以注册，系统会发送验证邮件。完成验证后返回登录。");
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "无法连接账户服务，请重试。");
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: t.dark ? "#000" : t.background }}>
      {/* The artwork is always black, so like the Web it only shows in the dark theme. */}
      {t.dark && (
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={StyleSheet.absoluteFill}
        >
          <Image
            source={require("../../assets/auth-backdrop.jpg")}
            resizeMode="cover"
            style={{ width: "100%", height: "100%" }}
          />
        </View>
      )}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
          gap: 28,
        }}
      >
        <View
          accessibilityRole="header"
          style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
        >
          <Logo />
          <Copy size={22} bold localize={false}>
            Kolvex
          </Copy>
        </View>
        {!authConfigured ? (
          <Empty
            title="尚未配置账户服务"
            message="配置 Supabase 地址和公共密钥后，可使用现有账户登录。"
          />
        ) : (
          <Glass clear style={{ padding: 24, gap: 20 }}>
            <Copy size={30} bold>
              欢迎回来
            </Copy>
            <Filters
              stretch
              values={[
                ["login", "登录"],
                ["register", "注册"],
              ]}
              value={mode}
              onChange={(v) => {
                if (!busy) {
                  setMode(v);
                  setFieldError({});
                  setError(undefined);
                  setNotice(undefined);
                }
              }}
            />
            <Field
              label="邮箱"
              placeholder="输入邮箱地址"
              error={fieldError.email}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              textContentType="username"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="next"
              editable={!busy}
            />
            <Field
              label="密码"
              placeholder="输入密码"
              error={fieldError.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              textContentType={mode === "login" ? "password" : "newPassword"}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              editable={!busy}
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={text(show ? "隐藏密码" : "显示密码")}
                  onPress={() => setShow((v) => !v)}
                  hitSlop={4}
                  style={{
                    width: 44,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <SymbolView
                    name={{
                      ios: show ? "eye.slash" : "eye",
                      android: "visibility",
                      web: "visibility",
                    }}
                    size={20}
                    tintColor={t.secondary}
                  />
                </Pressable>
              }
            />
            {mode === "login" && (
              <View style={{ alignItems: "flex-end", marginTop: -8 }}>
                <Copy
                  size={14}
                  bold
                  color={t.accent}
                  role="link"
                  onPress={() => router.push("/auth/recovery")}
                >
                  忘记密码？
                </Copy>
              </View>
            )}
            {!!error && <Failure message={error} />}
            {!!notice && <Copy size={14}>{notice}</Copy>}
            <Button
              variant="primary"
              disabled={busy}
              onPress={() => void submit()}
            >
              {busy ? "正在处理…" : mode === "login" ? "登录" : "创建账户"}
            </Button>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 16 }}
            >
              <View style={{ flex: 1, height: 1, backgroundColor: t.rim }} />
              <Copy size={12} muted>
                或
              </Copy>
              <View style={{ flex: 1, height: 1, backgroundColor: t.rim }} />
            </View>
            <Button
              block
              icon={
                <Image
                  source={require("../../assets/google.png")}
                  style={{ width: 20, height: 20 }}
                  accessibilityElementsHidden
                />
              }
              disabled={oauthAction.busy || busy}
              onPress={() =>
                void oauthAction.run(async () => {
                  if (!(await oauth("google"))) return false;
                  router.replace("/");
                })
              }
            >
              使用 Google 继续
            </Button>
            <MutationStatus {...oauthAction} />
          </Glass>
        )}
      </ScrollView>
    </View>
  );
}
