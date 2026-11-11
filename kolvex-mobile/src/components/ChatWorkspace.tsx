// The Web's chat WorkspacePicker: shows which workspace a chat belongs to, and lets the
// reader add it to one (existing or new) or take it out.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import {
  attachChat,
  createWorkspace,
  listWorkspaces,
  parseTickers,
  workspaceErrorCode,
  workspaceForChat,
} from "../lib/researchWorkspaceApi";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { Field } from "./Content";
import { Sheet } from "./PaperTrading";
import { Button, Copy, Failure, Glass, LoadingStatus, Skeleton } from "./UI";
import { workspaceErrorText } from "./Workspace";

/**
 * The Web's chat WorkspacePicker as a header action: which workspace the chat belongs to,
 * and a press that opens it or adds the chat to one. `sheet` must be rendered by the page.
 */
export function useChatWorkspace(conversationId: string, user: string) {
  const [revision, setRevision] = useState(0);
  const current = useResource(
    `chat-workspace:${user}:${conversationId}:${revision}`,
    (signal) => workspaceForChat(conversationId, user, signal),
  );
  const [open, setOpen] = useState(false);
  const workspace = current.data;
  return {
    // Before the workspace migration the backend answers 503; the chat keeps working.
    available: !(current.error && current.data === undefined),
    workspace,
    loading: current.loading && !workspace,
    label: workspace ? `工作区 · ${workspace.title}` : "加入工作区",
    press: () =>
      workspace
        ? router.push(`/workspace/${encodeURIComponent(workspace.id)}`)
        : setOpen(true),
    sheet: (
      <Sheet title="加入工作区" visible={open} onClose={() => setOpen(false)}>
        {open && (
          <Picker
            conversationId={conversationId}
            user={user}
            onDone={() => {
              setOpen(false);
              setRevision((v) => v + 1);
            }}
          />
        )}
      </Sheet>
    ),
  };
}

function Picker({
  conversationId,
  user,
  onDone,
}: {
  conversationId: string;
  user: string;
  onDone: () => void;
}) {
  const t = useTheme();
  const list = useResource(`workspaces:${user}`, (signal) =>
    listWorkspaces(user, signal),
  );
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [tickers, setTickers] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const join = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await attachChat(id, conversationId, user);
      onDone();
    } catch (e) {
      setError(workspaceErrorCode(e));
      setBusy(false);
    }
  };
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const workspace = await createWorkspace(user, {
        title: title.trim(),
        tickers: parseTickers(tickers),
      });
      await attachChat(workspace.id, conversationId, user);
      onDone();
    } catch (e) {
      setError(workspaceErrorCode(e));
      setBusy(false);
    }
  };
  if (creating)
    return (
      <View style={{ gap: 12 }}>
        <Field
          label="名称"
          placeholder="例如：AI 半导体"
          value={title}
          maxLength={120}
          autoFocus
          onChangeText={setTitle}
        />
        <Field
          label="股票"
          placeholder="NVDA AMD TSM"
          value={tickers}
          autoCapitalize="characters"
          autoCorrect={false}
          onChangeText={setTickers}
        />
        {!!error && <Failure message={workspaceErrorText(error)} />}
        <Button
          variant="primary"
          disabled={!title.trim() || busy}
          onPress={() => void create()}
        >
          创建并加入
        </Button>
        <Button onPress={() => setCreating(false)}>返回</Button>
      </View>
    );
  const items = list.data ?? [];
  return (
    <View style={{ gap: 12 }}>
      {list.loading && !list.data ? (
        <LoadingStatus label="加载中">
          <Skeleton height={48} />
        </LoadingStatus>
      ) : list.error && !list.data ? (
        <Failure message="工作区加载失败。" retry={list.refresh} />
      ) : !items.length ? (
        <Copy size={14} muted>
          还没有工作区。
        </Copy>
      ) : (
        <Glass style={{ paddingHorizontal: 16 }}>
          {items.map((item, index) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void join(item.id)}
              style={({ pressed }) => ({
                minHeight: 52,
                justifyContent: "center",
                gap: 2,
                paddingVertical: 8,
                borderTopWidth: index ? 1 : 0,
                borderColor: t.border,
                opacity: pressed || busy ? 0.6 : 1,
              })}
            >
              <Copy bold lines={1} localize={false}>
                {item.title}
              </Copy>
              {item.tickers.length > 0 && (
                <Copy size={12} muted lines={1} localize={false}>
                  {item.tickers.join(" · ")}
                </Copy>
              )}
            </Pressable>
          ))}
        </Glass>
      )}
      {!!error && <Failure message={workspaceErrorText(error)} />}
      <Button onPress={() => setCreating(true)}>新建工作区</Button>
    </View>
  );
}
