import { useState } from "react";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { authRedirect } from "../../lib/authFlow";
import { useAuth } from "../../state/Auth";
import { useMutation } from "../../lib/useMutation";
import { Field } from "../../components/Content";
import { MutationStatus } from "../../components/MutationStatus";
import { Page, Button, Copy } from "../../components/UI";
export default function Recovery() {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const m = useMutation();
  return (
    <Page title={auth.session ? "设置新密码" : "找回账户"}>
      {auth.session ? (
        <>
          <Field
            label="新密码（至少 6 个字符）"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
          />
          <Button onPress={() => setShow((v) => !v)}>
            {show ? "隐藏密码" : "显示密码"}
          </Button>
          <Button
            disabled={m.busy || password.length < 6}
            onPress={() =>
              void m.run(async () => {
                const r = await supabase?.auth.updateUser({ password });
                if (!r || r.error) throw new Error("密码未更新，请重试。");
                setPassword("");
                router.replace("/account");
              })
            }
          >
            保存新密码
          </Button>
        </>
      ) : (
        <>
          <Field
            label="注册邮箱"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <Button
            disabled={
              m.busy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
            }
            onPress={() =>
              void m.run(async () => {
                const r = await supabase?.auth.resetPasswordForEmail(
                  email.trim(),
                  { redirectTo: authRedirect() },
                );
                if (!r || r.error) throw new Error("邮件未发送，请稍后重试。");
              })
            }
          >
            发送恢复邮件
          </Button>
          <Copy muted>
            如邮箱可用于恢复，系统会发送链接；请在发起恢复的同一设备打开。
          </Copy>
        </>
      )}
      <MutationStatus {...m} />
    </Page>
  );
}
