import { router, useFocusEffect } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { AuthGate, Field } from "../../components/Content";
import {
  Button,
  Copy,
  Glass,
  LoadingStatus,
  Page,
  Skeleton,
  phone,
} from "../../components/UI";
import { workspaceErrorText } from "../../components/Workspace";
import { useText } from "../../lib/i18n";
import {
  createWorkspace,
  listWorkspaces,
  parseTickers,
  workspaceErrorCode,
} from "../../lib/researchWorkspaceApi";
import { useTheme } from "../../lib/theme";
import { useResource } from "../../lib/useResource";
import { useAuth } from "../../state/Auth";

const row = {
  flexDirection: "row",
  alignItems: "center",
  gap: phone(12),
} as const;
const skeleton = Array.from({ length: 3 }, (_, index) => (
  <View key={index} style={[row, { minHeight: phone(80) }]}>
    <Skeleton height={phone(32)} width={phone(32)} radius={999} />
    <View style={{ flex: 1, gap: phone(8) }}>
      <Skeleton height={phone(16)} width={phone(160)} />
      <Skeleton height={phone(12)} width={phone(224)} />
    </View>
  </View>
));

export default function Workspaces() {
  return (
    <AuthGate title="工作区" skeleton={skeleton}>
      <WorkspaceList />
    </AuthGate>
  );
}

function WorkspaceList() {
  const t = useTheme();
  const text = useText();
  const user = useAuth().session!.user.id;
  const resource = useResource(`workspaces:${user}`, (signal) =>
    listWorkspaces(user, signal),
  );
  const refresh = resource.refresh;
  const visited = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (visited.current) refresh();
      visited.current = true;
    }, [refresh]),
  );
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [tickers, setTickers] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [formError, setFormError] = useState<string>();
  const items = resource.data ?? [];

  async function submit() {
    if (!title.trim() || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError(undefined);
    try {
      const workspace = await createWorkspace(user, {
        title: title.trim(),
        tickers: parseTickers(tickers),
      });
      setCreating(false);
      setTitle("");
      setTickers("");
      resource.refresh();
      router.push({
        pathname: "/workspace/[id]",
        params: { id: workspace.id },
      });
    } catch (error) {
      setFormError(workspaceErrorCode(error));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const newButton = (primary = false) => (
    <Button
      size="sm"
      variant={primary ? "primary" : "neutral"}
      block={false}
      label="新建工作区"
      icon={
        <SymbolView
          name={{
            ios: "folder.badge.plus",
            android: "create_new_folder",
            web: "create_new_folder",
          }}
          size={phone(16)}
          tintColor={primary ? t.onBrand : t.text}
        />
      }
      onPress={() => setCreating(true)}
    >
      新建工作区
    </Button>
  );

  return (
    <Page
      title="工作区"
      hideTitle
      onRefresh={resource.refresh}
      refreshing={resource.loading && !!resource.data}
    >
      <View
        style={{ marginHorizontal: 2, paddingTop: phone(8), gap: phone(24) }}
      >
        <View
          style={[
            row,
            { justifyContent: "space-between", minHeight: phone(36) },
          ]}
        >
          <Copy size={24} lineHeight={32} bold>
            工作区
          </Copy>
          {!creating && newButton()}
        </View>
        {creating && (
          <View style={{ gap: phone(12) }}>
            <Field
              label="名称"
              hideLabel
              style={{ minHeight: 44 }}
              placeholder={text("名称，例如：AI 半导体")}
              value={title}
              maxLength={120}
              autoFocus
              returnKeyType="next"
              onChangeText={setTitle}
            />
            <Field
              label="股票"
              hideLabel
              style={{ minHeight: 44 }}
              placeholder="NVDA AMD TSM"
              value={tickers}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              onChangeText={setTickers}
            />
            <View style={{ flexDirection: "row", gap: phone(8) }}>
              <Button
                disabled={saving}
                onPress={() => {
                  setCreating(false);
                  setFormError(undefined);
                }}
              >
                取消
              </Button>
              <Button
                variant="primary"
                block={false}
                disabled={!title.trim() || saving}
                icon={
                  saving ? (
                    <ActivityIndicator size="small" color={t.onBrand} />
                  ) : undefined
                }
                onPress={() => void submit()}
              >
                创建
              </Button>
            </View>
            {!!formError && (
              <Copy size={14} color={t.negative}>
                {workspaceErrorText(formError)}
              </Copy>
            )}
          </View>
        )}
        <Glass clear style={{ padding: 12 }}>
          {resource.loading && !resource.data ? (
            <LoadingStatus>{skeleton}</LoadingStatus>
          ) : !!resource.error && !resource.data ? (
            <View style={{ paddingVertical: phone(24), gap: phone(16) }}>
              <Copy size={14}>{workspaceErrorText(resource.error)}</Copy>
              <Button size="sm" onPress={resource.refresh}>
                重试
              </Button>
            </View>
          ) : !items.length ? (
            <View style={{ paddingVertical: phone(24), gap: phone(16) }}>
              <Copy size={14}>按主题归集对话，让研究团队一起研究。</Copy>
              {!creating && newButton(true)}
            </View>
          ) : (
            items.map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="link"
                onPress={() =>
                  router.push({
                    pathname: "/workspace/[id]",
                    params: { id: item.id },
                  })
                }
                style={({ pressed }) => [
                  row,
                  {
                    paddingVertical: phone(8),
                    minHeight: 44,
                    borderRadius: phone(16),
                    backgroundColor: pressed ? t.wash : undefined,
                  },
                ]}
              >
                <View
                  style={{
                    width: phone(32),
                    height: phone(32),
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: t.wash,
                  }}
                >
                  <SymbolView
                    name={{ ios: "folder", android: "folder", web: "folder" }}
                    size={phone(16)}
                    tintColor={t.text}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Copy
                    size={15}
                    lineHeight={20}
                    bold
                    lines={1}
                    localize={false}
                  >
                    {item.title}
                  </Copy>
                  <Copy size={12} lineHeight={16} muted lines={1}>
                    {item.tickers.length > 0
                      ? `${item.tickers.join(" · ")} · `
                      : ""}
                    {`${item.chat_count} 个对话`}
                  </Copy>
                </View>
                <SymbolView
                  name={{
                    ios: "arrow.up.right",
                    android: "north_east",
                    web: "north_east",
                  }}
                  size={phone(14)}
                  tintColor={t.secondary}
                />
              </Pressable>
            ))
          )}
        </Glass>
      </View>
    </Page>
  );
}
