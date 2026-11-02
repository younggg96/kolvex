import { Image } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { apiRequest } from "../lib/http";
import { useMutation } from "../lib/useMutation";
import { useText } from "../lib/i18n";
import { safeExternal } from "../lib/links";
import { Button, Copy, Glass } from "./UI";
import { MutationStatus } from "./MutationStatus";
import { ConfirmAction } from "./ConfirmAction";
export function AvatarEditor({
  user,
  url,
  onChanged,
}: {
  user: string;
  url?: string;
  onChanged: () => void;
}) {
  const m = useMutation();
  const text = useText();
  const [selected, setSelected] = useState<ImagePicker.ImagePickerAsset>();
  const uri = selected?.uri || safeExternal(url || "");
  return (
    <Glass style={{ padding: 20, gap: 12 }}>
      {uri && (
        <Image
          source={{ uri }}
          style={{ width: 88, height: 88, borderRadius: 44 }}
          accessibilityLabel={text("账户头像")}
        />
      )}
      <Copy muted>
        先从照片库选择并裁剪，确认后上传；头像将使用现有账户的公开头像地址。
      </Copy>
      <Button
        disabled={m.busy}
        onPress={() =>
          void m.run(async () => {
            const picked = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
              base64: true,
            });
            if (!picked.canceled) setSelected(picked.assets[0]);
          })
        }
      >
        选择并裁剪头像
      </Button>
      {selected && (
        <Button
          disabled={m.busy}
          onPress={() =>
            void m.run(async (signal) => {
              if (
                !selected.base64 ||
                (selected.base64.length * 3) / 4 > 5 * 1024 * 1024
              )
                throw new Error("请选择小于 5MB 的图片。");
              const mime = selected.mimeType;
              if (
                !mime ||
                ![
                  "image/jpeg",
                  "image/jpg",
                  "image/png",
                  "image/gif",
                  "image/webp",
                ].includes(mime)
              )
                throw new Error("请选择 JPEG、PNG、GIF 或 WebP 图片。");
              const form = new FormData();
              form.append("image_data", selected.base64);
              form.append("content_type", mime);
              const result = await apiRequest<{
                success: boolean;
                url?: string;
              }>("/upload/avatar/base64", {
                method: "POST",
                form,
                signal,
                authenticated: true,
                expectedUser: user,
              });
              if (!result.success || !safeExternal(result.url || ""))
                throw new Error("头像上传未完成，请重试。");
              await apiRequest("/users/me", {
                method: "PUT",
                body: { avatar_url: result.url },
                signal,
                authenticated: true,
                expectedUser: user,
              });
              setSelected(undefined);
              onChanged();
            })
          }
        >
          确认上传头像
        </Button>
      )}
      {url && (
        <ConfirmAction
          label="移除账户头像"
          description="从个人资料中移除当前头像。"
          disabled={m.busy}
          onConfirm={() =>
            void m.run(async (signal) => {
              await apiRequest("/users/me", {
                method: "PUT",
                body: { avatar_url: null },
                signal,
                authenticated: true,
                expectedUser: user,
              });
              setSelected(undefined);
              onChanged();
            })
          }
        />
      )}
      <MutationStatus {...m} />
    </Glass>
  );
}
