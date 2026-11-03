import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useAuth } from "../state/Auth";
import { apiURL } from "../lib/config";
import { AvatarEditor } from "../components/AvatarEditor";
import { apiRequest } from "../lib/http";
import { profile } from "../lib/contentApi";
import { useResource } from "../lib/useResource";
import { Button, Copy, Failure, Glass, Page, LoadingStatus } from "../components/UI";
import { Field } from "../components/Content";
export default function Account() {
  const auth = useAuth();
  if (!auth.ready)
    return (
      <Page title="账户">
        <LoadingStatus />
      </Page>
    );
  // Signing out unmounts this route through the root layout's guard.
  return auth.session ? <SignedIn key={auth.session.user.id} /> : null;
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
        自选通过现有账户同步。
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
