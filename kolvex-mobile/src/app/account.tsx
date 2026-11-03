import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../state/Auth";
import { supabase } from "../lib/supabase";
import { authConfigured, apiURL, webURL } from "../lib/config";
import { AvatarEditor } from "../components/AvatarEditor";
import { apiRequest } from "../lib/http";
import { oauth } from "../lib/authFlow";
import { useMutation } from "../lib/useMutation";
import { MutationStatus } from "../components/MutationStatus";
import { credentialsError } from "../lib/links";
import { profile } from "../lib/contentApi";
import { useResource } from "../lib/useResource";
import {
  Button,
  Copy,
  Empty,
  Failure,
  Glass,
  Page,
  Skeleton,
} from "../components/UI";
import { Field, Filters, SourceLink } from "../components/Content";
export default function Account() {
  const auth = useAuth();
  if (!auth.ready)
    return (
      <Page title="账户">
        <Skeleton />
      </Page>
    );
  return auth.session ? <SignedIn key={auth.session.user.id} /> : <SignIn />;
}
function SignIn() {
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
    <Page title="你的 Kolvex" subtitle="与你的网页账户保持连接。">
      {!authConfigured ? (
        <Empty
          title="尚未配置账户服务"
          message="配置 Supabase 地址和公共密钥后，可使用现有账户登录。公共阅读与本机自选仍可使用。"
        />
      ) : (
        <>
          <Button
            disabled={oauthAction.busy || busy}
            onPress={() =>
              void oauthAction.run(async () => {
                if (await oauth("google")) router.replace("/account");
              })
            }
          >
            使用 Google 登录
          </Button>
          <Button
            disabled={oauthAction.busy || busy}
            onPress={() =>
              void oauthAction.run(async () => {
                if (await oauth("apple")) router.replace("/account");
              })
            }
          >
            使用 Apple 登录
          </Button>
          <MutationStatus {...oauthAction} />
          <Button onPress={() => router.push("/auth/recovery")}>
            找回密码
          </Button>
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
  );
}
function SignedIn() {
  const auth = useAuth();
  const user = auth.session!.user;
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const operation = useRef<AbortController | null>(null);
  const resource = useResource(user.id, (signal) =>
    apiURL ? profile(user.id, signal) : Promise.resolve(null),
  );
  useEffect(() => () => operation.current?.abort(), []);
  async function save() {
    if (operation.current || name.trim().length > 100) {
      setError("姓名最多需要 100 个字符。");
      return;
    }
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setError(undefined);
    try {
      if (phone.trim() && !/^\+[1-9]\d{1,14}$/.test(phone.trim()))
        throw new Error("手机号请使用 E.164 格式，例如 +14155551234。");
      await apiRequest("/users/me", {
        method: "PUT",
        body: {
          full_name: name.trim() || null,
          username: username.trim() || null,
          phone_e164: phone.trim() || null,
        },
        signal: controller.signal,
        authenticated: true,
        expectedUser: user.id,
      });
      if (!controller.signal.aborted) {
        resource.refresh();
        setEditing(false);
        setNotice("资料已保存。");
      }
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "保存未完成。");
    } finally {
      operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <Page title="账户" subtitle={user.email}>
      <Glass style={{ padding: 20, gap: 8 }}>
        <Copy size={20} bold localize={false}>
          {resource.data?.full_name || "Kolvex 用户"}
        </Copy>
        <Copy size={14} muted>
          会员类型：{resource.data?.membership ?? "—"}
        </Copy>
      </Glass>
      <AvatarEditor
        user={user.id}
        url={resource.data?.avatar_url}
        onChanged={resource.refresh}
      />
      {!!auth.error && <Failure message={auth.error} />}
      {!!resource.error && (
        <Failure message={resource.error} retry={resource.refresh} />
      )}
      {!!error && <Failure message={error} />}
      {!!notice && <Copy>{notice}</Copy>}
      {editing ? (
        <>
          <Field
            label="姓名（可留空）"
            value={name}
            onChangeText={setName}
            maxLength={100}
            editable={!busy}
          />
          <Field
            label="用户名（可留空）"
            value={username}
            onChangeText={setUsername}
            maxLength={50}
          />
          <Field
            label="手机号（E.164，可留空）"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={20}
          />
          <View style={{ gap: 8 }}>
            <Button disabled={busy} onPress={() => void save()}>
              {busy ? "正在保存…" : "保存资料"}
            </Button>
            <Button disabled={busy} onPress={() => setEditing(false)}>
              取消
            </Button>
          </View>
        </>
      ) : (
        <Button
          disabled={!apiURL}
          onPress={() => {
            setName(resource.data?.full_name ?? "");
            setUsername(resource.data?.username ?? "");
            setPhone(resource.data?.phone_e164 ?? "");
            setEditing(true);
          }}
        >
          编辑资料
        </Button>
      )}
      <Copy size={14} muted>
        已登录时，自选通过现有账户同步。访客本机自选不会自动合并到你的账户。
      </Copy>
      <Button
        disabled={busy}
        onPress={() => {
          setBusy(true);
          void auth.signOut().catch(() => {
            setError("退出未完成，请重试。");
            setBusy(false);
          });
        }}
      >
        退出这台设备
      </Button>
    </Page>
  );
}
