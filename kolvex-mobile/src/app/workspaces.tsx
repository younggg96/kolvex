import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { AuthGate, Field } from "../components/Content";
import { CardsSkeleton } from "../components/Skeletons";
import {
  Button,
  Copy,
  Empty,
  Failure,
  Glass,
  LoadingStatus,
  Page,
} from "../components/UI";
import {
  AgentStatusText,
  StanceText,
  formatRunTime,
  workspaceErrorText,
} from "../components/Workspace";
import {
  createWorkspace,
  listWorkspaces,
  parseTickers,
  workspaceErrorCode,
} from "../lib/researchWorkspaceApi";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { useAuth } from "../state/Auth";
import { usePreferences } from "../state/Preferences";

const skeleton = (
  <CardsSkeleton
    count={3}
    lines={[
      { size: 16, width: "50%" },
      { size: 12, width: "70%" },
    ]}
  />
);

export default function Workspaces() {
  return (
    <AuthGate title="工作区" skeleton={skeleton}>
      <List />
    </AuthGate>
  );
}

function List() {
  const t = useTheme();
  const { locale } = usePreferences();
  const user = useAuth().session!.user.id;
  const resource = useResource(`workspaces:${user}`, (signal) =>
    listWorkspaces(user, signal),
  );
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [tickers, setTickers] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const workspace = await createWorkspace(user, {
        title: title.trim(),
        tickers: parseTickers(tickers),
      });
      setCreating(false);
      setTitle("");
      setTickers("");
      resource.refresh();
      router.push(`/workspace/${encodeURIComponent(workspace.id)}`);
    } catch (error) {
      setFormError(workspaceErrorCode(error));
    } finally {
      setSaving(false);
    }
  };
  const items = resource.data ?? [];
  return (
    <Page
      title="工作区"
      onRefresh={resource.refresh}
      refreshing={resource.loading && !!resource.data}
    >
      {creating ? (
        <Glass style={{ padding: 16, gap: 12 }}>
          <Field
            label="名称"
            placeholder="名称，例如：AI 半导体"
            value={title}
            maxLength={120}
            autoFocus
            returnKeyType="next"
            onChangeText={setTitle}
          />
          <Field
            label="股票"
            placeholder="NVDA AMD TSM"
            value={tickers}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            onChangeText={setTickers}
          />
          {!!formError && <Failure message={workspaceErrorText(formError)} />}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              onPress={() => {
                setCreating(false);
                setFormError(null);
              }}
            >
              取消
            </Button>
            <View style={{ flex: 1 }}>
              <Button
                variant="primary"
                disabled={!title.trim() || saving}
                onPress={() => void submit()}
              >
                {saving ? "正在创建…" : "创建"}
              </Button>
            </View>
          </View>
        </Glass>
      ) : (
        <Button onPress={() => setCreating(true)}>新建工作区</Button>
      )}
      {resource.loading && !resource.data ? (
        <LoadingStatus>{skeleton}</LoadingStatus>
      ) : resource.error && !resource.data ? (
        <Failure message="工作区暂时不可用。" retry={resource.refresh} />
      ) : !items.length ? (
        <Empty
          title="还没有工作区"
          message="按主题归集对话，让研究团队一起研究。"
        />
      ) : (
        <Glass style={{ paddingHorizontal: 16 }}>
          {items.map((item, index) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              onPress={() =>
                router.push(`/workspace/${encodeURIComponent(item.id)}`)
              }
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                minHeight: 64,
                paddingVertical: 12,
                borderTopWidth: index ? 1 : 0,
                borderColor: t.border,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Copy bold lines={1} localize={false}>
                  {item.title}
                </Copy>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {item.tickers.length > 0 && (
                    <Copy size={12} muted lines={1} localize={false}>
                      {`${item.tickers.join(" · ")} ·`}
                    </Copy>
                  )}
                  <Copy size={12} muted>{`${item.chat_count} 个对话`}</Copy>
                </View>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                {item.latest_run?.status === "running" ? (
                  <AgentStatusText status="running" />
                ) : (
                  <StanceText stance={item.latest_run?.stance} />
                )}
                {item.latest_run ? (
                  <Copy size={12} muted localize={false}>
                    {formatRunTime(
                      item.latest_run.completed_at ??
                        item.latest_run.started_at,
                      locale,
                    )}
                  </Copy>
                ) : (
                  <Copy size={12} muted>
                    未研究
                  </Copy>
                )}
              </View>
              <Copy muted localize={false}>
                ›
              </Copy>
            </Pressable>
          ))}
        </Glass>
      )}
    </Page>
  );
}
