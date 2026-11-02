import { useState } from "react";
import { apiRequest } from "../lib/http";
import { useMutation } from "../lib/useMutation";
import { Button, Glass } from "./UI";
import { Field } from "./Content";
import { ConfirmAction } from "./ConfirmAction";
import { MutationStatus } from "./MutationStatus";
export function ChatActions({
  id,
  user,
  title,
  onChanged,
}: {
  id: string;
  user: string;
  title: string;
  onChanged: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(title);
  const m = useMutation();
  return (
    <Glass style={{ padding: 12, gap: 12 }}>
      <Button onPress={() => setEdit((v) => !v)}>重命名 / 删除</Button>
      {edit && (
        <>
          <Field
            editable={!m.busy}
            label="对话标题"
            value={name}
            onChangeText={setName}
            maxLength={200}
          />
          <Button
            disabled={m.busy || !name.trim()}
            onPress={() =>
              void m.run(async (signal) => {
                await apiRequest(
                  `/chat/conversations/${encodeURIComponent(id)}`,
                  {
                    method: "PATCH",
                    body: { title: name.trim() },
                    authenticated: true,
                    expectedUser: user,
                    signal,
                  },
                );
                setEdit(false);
                onChanged();
              })
            }
          >
            保存标题
          </Button>
          <ConfirmAction
            disabled={m.busy}
            label="删除此对话"
            description="此对话及消息将被永久删除，无法恢复。"
            onConfirm={() =>
              void m.run(async (signal) => {
                await apiRequest(
                  `/chat/conversations/${encodeURIComponent(id)}`,
                  {
                    method: "DELETE",
                    authenticated: true,
                    expectedUser: user,
                    signal,
                  },
                );
                onChanged();
              })
            }
          />
        </>
      )}
      <MutationStatus {...m} />
    </Glass>
  );
}
