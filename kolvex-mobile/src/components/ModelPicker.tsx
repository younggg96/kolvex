import { apiRequest } from "../lib/http";
import { MODEL_CONFIGS, providerId } from "../lib/aiModels";
import { useResource } from "../lib/useResource";
import { Copy, Button } from "./UI";
import { Filters } from "./Content";
export function ModelPicker({
  user,
  value,
  onChange,
  disabled = false,
}: {
  user: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const r = useResource(`providers:${user}`, (signal) =>
    apiRequest<{ available_providers: string[] }>(
      "/user-api-keys/available-providers",
      { signal, authenticated: true, expectedUser: user },
    ),
  );
  const models = MODEL_CONFIGS.filter((m) =>
    r.data?.available_providers.includes(providerId[m.provider]),
  );
  return (
    <>
      <Copy size={14} muted>
        模型 · {value || "服务器默认"}
      </Copy>
      <Filters
        disabled={disabled}
        values={[
          ["", "服务器默认"],
          ...models.map((m) => [m.id, m.name] as const),
        ]}
        value={value}
        onChange={onChange}
      />
      {!!r.error && <Button onPress={r.refresh}>重新读取可用模型</Button>}
    </>
  );
}
