import { useState } from "react";
import { FormSkeleton } from "../components/Skeletons";
import { useAuth } from "../state/Auth";
import { usePreferences, type Appearance } from "../state/Preferences";
import { apiRequest } from "../lib/http";
import { useResource } from "../lib/useResource";
import { useMutation } from "../lib/useMutation";
import { AuthGate, Field, Filters, ResourceState } from "../components/Content";
import { ConfirmAction } from "../components/ConfirmAction";
import { Page, Copy, Button, Failure, Glass, Section } from "../components/UI";
export default function Preferences() {
  const p = usePreferences();
  const m = useMutation();
  return (
    <Page title="显示与模型设置">
      <Section title="界面语言" />
      <Filters
        disabled={m.busy}
        values={[
          ["zh", "简体中文"],
          ["en", "English"],
        ]}
        value={p.locale}
        onChange={(v) => void m.run(() => p.save({ locale: v as "zh" | "en" }))}
      />
      <Copy muted>
        原始内容保留来源语言；有英文版本的日报和摘要按所选语言显示。
      </Copy>
      <Section title="外观" />
      <Filters
        disabled={m.busy}
        values={[
          ["SYSTEM", "跟随系统"],
          ["LIGHT", "浅色"],
          ["DARK", "深色"],
        ]}
        value={p.theme}
        onChange={(v) => {
          void m.run(() => p.save({ theme: v as Appearance }));
        }}
      />
      {(m.error || p.error) && <Failure message={m.error || p.error!} />}
      <Copy muted>
        外观与 Web 使用相同颜色；iOS 使用 SwiftUI 玻璃按钮和原生 Liquid
        Glass。减少透明度时跟随系统。
      </Copy>
      <AuthGate skeleton={<FormSkeleton fields={2} />} inline title="模型与 API 密钥">
        <Keys />
      </AuthGate>
    </Page>
  );
}
function Keys() {
  const user = useAuth().session!.user.id;
  const r = useResource(`keys:${user}`, (signal) =>
    apiRequest<{
      keys: { provider: string; api_key_masked: string }[];
      supported_providers: string[];
    }>("/user-api-keys", { signal, authenticated: true, expectedUser: user }),
  );
  const [provider, setProvider] = useState("");
  const [secret, setSecret] = useState("");
  const [show, setShow] = useState(false);
  const m = useMutation();
  const selected = provider || r.data?.supported_providers[0] || "";
  return (
    <>
      <Section title="模型服务密钥" />
      <ResourceState skeleton={<FormSkeleton fields={2} />} resource={r} empty={!r.data} message="密钥设置暂不可用" />
      <Copy muted>
        密钥仅提交至现有 Kolvex 后端。读取时只显示掩码；不会写入手机本地存储。
      </Copy>
      <Filters
        disabled={m.busy}
        values={(r.data?.supported_providers ?? []).map((p) => [p, p] as const)}
        value={selected}
        onChange={(v) => {
          setProvider(v);
          setSecret("");
        }}
      />
      <Field
        editable={!m.busy}
        label="API 密钥"
        value={secret}
        onChangeText={setSecret}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={500}
      />
      <Button onPress={() => setShow((v) => !v)}>
        {show ? "隐藏密钥" : "显示密钥"}
      </Button>
      <Button
        disabled={m.busy || !secret.trim() || !selected}
        onPress={() =>
          void m.run(async (signal) => {
            await apiRequest("/user-api-keys", {
              method: "PUT",
              body: { provider: selected, api_key: secret },
              signal,
              authenticated: true,
              expectedUser: user,
            });
            setSecret("");
            r.refresh();
          })
        }
      >
        {m.busy ? "正在保存…" : "保存密钥"}
      </Button>
      {!!m.error && <Failure message={m.error} />}
      {!!m.message && <Copy>{m.message}</Copy>}
      {r.data?.keys.map((k) => (
        <Glass key={k.provider} style={{ padding: 20, gap: 12 }}>
          <Copy>
            {k.provider} · {k.api_key_masked}
          </Copy>
          <ConfirmAction
            label={`删除 ${k.provider} 密钥`}
            description="后端将移除此服务密钥，依赖此密钥的 AI 功能可能暂不可用。"
            disabled={m.busy}
            onConfirm={() =>
              void m.run(async (signal) => {
                await apiRequest(
                  `/user-api-keys/${encodeURIComponent(k.provider)}`,
                  {
                    method: "DELETE",
                    signal,
                    authenticated: true,
                    expectedUser: user,
                  },
                );
                r.refresh();
              })
            }
          />
        </Glass>
      ))}
    </>
  );
}
