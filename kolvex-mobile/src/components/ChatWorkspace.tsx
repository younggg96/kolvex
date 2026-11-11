// The Web's chat WorkspacePicker: shows which workspace a chat belongs to, and lets the
// reader add it to one (existing or new) or take it out.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import {
  attachChat,
  createWorkspace,
  detachChat,
  listWorkspaces,
  parseTickers,
  workspaceErrorCode,
  workspaceForChat,
} from "../lib/researchWorkspaceApi";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { Field } from "./Content";
import { Sheet } from "./PaperTrading";
import { SymbolView } from "expo-symbols";
import { Button, Copy, Failure, Glass, LoadingStatus, Skeleton } from "./UI";
import { workspaceErrorText } from "./Workspace";

export function ChatWorkspace({
  conversationId,
  user,
  compact = false,
}: {
  conversationId: string;
  user: string;
  /** The Web's title-bar pill: the workspace's name, or "加入工作区". */
  compact?: boolean;
}) {
  const t = useTheme();
  const [revision, setRevision] = useState(0);
  const current = useResource(
    `chat-workspace:${user}:${conversationId}:${revision}`,
    (signal) => workspaceForChat(conversationId, user, signal),
  );
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workspace = current.data;
  // Before the workspace migration the backend answers 503; the chat keeps working.
  if (current.error && current.data === undefined) return null;
  const sheet = (
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
  );
  if (compact)
    return (
      <>
        <Pressable
          accessibilityRole="button"
          disabled={current.loading && !workspace}
          onPress={() =>
            workspace
              ? router.push(`/workspace/${encodeURIComponent(workspace.id)}`)
              : setOpen(true)
          }
          hitSlop={6}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            maxWidth: 160,
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: t.rim,
            backgroundColor: pressed ? t.wash : "transparent",
          })}
        >
          <SymbolView
            name={{ ios: "folder", android: "folder", web: "folder" }}
            size={13}
            tintColor={t.text}
          />
          {workspace ? (
            <Copy size={13} bold lines={1} localize={false}>
              {workspace.title}
            </Copy>
          ) : (
            <Copy size={13} bold lines={1}>
              加入工作区
            </Copy>
          )}
        </Pressable>
        {sheet}
      </>
    );
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {workspace ? (
        <>
          <Button
            onPress={() =>
              router.push(`/workspace/${encodeURIComponent(workspace.id)}`)
            }
          >
            {`工作区 · ${workspace.title}`}
          </Button>
          <Button
            onPress={() => {
              setError(null);
              detachChat(conversationId, user)
                .then(() => setRevision((v) => v + 1))
                .catch((e) => setError(workspaceErrorCode(e)));
            }}
          >
            移出此对话
          </Button>
        </>
      ) : (
        <Button disabled={current.loading} onPress={() => setOpen(true)}>
          加入工作区
        </Button>
      )}
      {!!error && <Failure message={workspaceErrorText(error)} />}
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
    </View>
  );
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
