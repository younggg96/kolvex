import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { authConfigured, webURL } from "../lib/config";
import { oauth } from "../lib/authFlow";
import { useMutation } from "../lib/useMutation";
import { MutationStatus } from "../components/MutationStatus";
import { credentialsError } from "../lib/links";
import { usePreferences } from "../state/Preferences";
import {
  Button,
  Copy,
  Empty,
  Failure,
  Glass,
  Page,
  StatusScrim,
} from "../components/UI";
import { Field, Filters, SourceLink } from "../components/Content";
export default function SignIn() {
  const { locale, save } = usePreferences();
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
      const result =
        mode === "login"
          ? await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            })
          : await supabase.auth.signUp({ email: email.trim(), password });
      if (result.error) {
        const message =
          result.error.code === "email_not_confirmed"
            ? "邮箱尚未验证，请先打开验证邮件。"
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
    <View style={{ flex: 1 }}>
      <Page title="登录 Kolvex" subtitle="使用账户继续。">
        <Filters
          values={[
            ["zh", "简体中文"],
            ["en", "English"],
          ]}
          value={locale}
          onChange={(value) => void save({ locale: value as "zh" | "en" })}
        />
        {!authConfigured ? (
          <Empty
            title="尚未配置账户服务"
            message="配置 Supabase 地址和公共密钥后，可使用现有账户登录。"
          />
        ) : (
          <>
            <Filters
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
              error={fieldError.email}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              editable={!busy}
            />
            <Field
              label="密码"
              error={fieldError.password}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              editable={!busy}
            />
            <Button onPress={() => setShow((v) => !v)}>
              {show ? "隐藏密码" : "显示密码"}
            </Button>
            {!!error && <Failure message={error} />}
            {!!notice && (
              <Glass style={{ padding: 16 }}>
                <Copy>{notice}</Copy>
              </Glass>
            )}
            <Button disabled={busy} onPress={() => void submit()}>
              {busy ? "正在处理…" : mode === "login" ? "登录" : "创建账户"}
            </Button>
            <Button
              disabled={oauthAction.busy || busy}
              onPress={() =>
                void oauthAction.run(async () => {
                  if (!(await oauth("google"))) return false;
                  router.replace("/");
                })
              }
            >
              使用 Google 登录
            </Button>
            <Button
              disabled={oauthAction.busy || busy}
              onPress={() =>
                void oauthAction.run(async () => {
                  if (!(await oauth("apple"))) return false;
                  router.replace("/");
                })
              }
            >
              使用 Apple 登录
            </Button>
            <MutationStatus {...oauthAction} />
            <Button onPress={() => router.push("/auth/recovery")}>
              找回密码
            </Button>
            {webURL.startsWith("https://") && (
              <SourceLink url={`${webURL}/auth/forgot-password`}>
                忘记密码？在网页版找回 ↗
              </SourceLink>
            )}
            <Copy size={12} muted>
              {Platform.OS === "web"
                ? "网页预览仅保留本次会话，刷新后需重新登录。"
                : "登录会话加密保存在设备安全存储中。"}{" "}
              邮箱验证要求沿用现有账户配置。
            </Copy>
          </>
        )}
      </Page>
      <StatusScrim />
    </View>
  );
}
