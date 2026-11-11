import { useState } from "react";
import {
  CardsSkeleton,
  ResultRowsSkeleton,
  ButtonsSkeleton,
} from "./Skeletons";
import { apiRequest } from "../lib/http";
import { useResource } from "../lib/useResource";
import { useMutation } from "../lib/useMutation";
import type { BriefSummary } from "../lib/contentTypes";
import { Button, Copy, Glass, Section } from "./UI";
import { Field, Pager, ResourceState } from "./Content";
import { ConfirmAction } from "./ConfirmAction";
import { MutationStatus } from "./MutationStatus";
function document(value: string) {
  if (value.length > 2_000_000) throw new Error("内容过大，请缩小后重试。");
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") throw new Error();
    return parsed;
  } catch {
    throw new Error("JSON 格式不正确，请检查后重试。");
  }
}
export function AdminBriefs({ user }: { user: string }) {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState("");
  const [validated, setValidated] = useState("");
  const [current, setCurrent] = useState<{ id: string; revision: string }>();
  const m = useMutation();
  const r = useResource(`admin-briefs:${user}:${page}`, (signal) =>
    apiRequest<{ items: BriefSummary[]; total: number }>(
      `/admin/briefs?page=${page}`,
      { signal, authenticated: true, expectedUser: user },
    ),
  );
  const change = (v: string) => {
    setDraft(v);
    setValidated("");
  };
  return (
    <>
      <Section title={current ? `编辑 ${current.id}` : "新增日报"} />
      <Copy muted>
        使用与 Web 相同的完整日报
        JSON，可包含双语文案、图片与来源。先验证再保存。编辑和删除使用读取时的版本号，冲突时不会覆盖。
      </Copy>
      <Field
        editable={!m.busy}
        label="日报 JSON"
        value={draft}
        onChangeText={change}
        multiline
        maxLength={2000000}
        style={{ minHeight: 240 }}
      />
      <Button
        disabled={m.busy || !draft.trim()}
        onPress={() =>
          void m.run(async (signal) => {
            await apiRequest("/admin/briefs/validate", {
              method: "POST",
              body: document(draft),
              signal,
              authenticated: true,
              expectedUser: user,
            });
            setValidated(draft);
          })
        }
      >
        验证日报
      </Button>
      <Button
        disabled={m.busy || !validated || validated !== draft}
        onPress={() =>
          void m.run(async (signal) => {
            await apiRequest(
              current
                ? `/admin/briefs/${encodeURIComponent(current.id)}`
                : "/admin/briefs",
              {
                method: current ? "PUT" : "POST",
                body: document(draft),
                revision: current?.revision,
                signal,
                authenticated: true,
                expectedUser: user,
              },
            );
            setCurrent(undefined);
            setDraft("");
            setValidated("");
            r.refresh();
          })
        }
      >
        保存日报
      </Button>
      {current && (
        <ConfirmAction
          label="删除此日报"
          description="日报将永久删除。版本冲突时服务器会拒绝，请重新读取。"
          disabled={m.busy}
          onConfirm={() =>
            void m.run(async (signal) => {
              await apiRequest(
                `/admin/briefs/${encodeURIComponent(current.id)}`,
                {
                  method: "DELETE",
                  revision: current.revision,
                  signal,
                  authenticated: true,
                  expectedUser: user,
                },
              );
              setCurrent(undefined);
              setDraft("");
              setValidated("");
              r.refresh();
            })
          }
        />
      )}
      <Button
        onPress={() => {
          setCurrent(undefined);
          setDraft("");
          setValidated("");
        }}
      >
        新建另一份日报
      </Button>
      <MutationStatus {...m} />
      <ResourceState
        skeleton={
          <CardsSkeleton
            lines={[{ size: 16 }]}
            buttons={1}
            padding={16}
            gap={8}
          />
        }
        resource={r}
        empty={!r.data?.items.length}
        message="暂无日报"
      />
      {r.data?.items.map((i) => (
        <Glass key={i.id} style={{ padding: 16, gap: 8 }}>
          <Copy>{i.title}</Copy>
          <Button
            disabled={m.busy}
            onPress={() =>
              void m.run(async (signal) => {
                const value = await apiRequest<{
                  payload: unknown;
                  revision: string;
                }>(`/admin/briefs/${encodeURIComponent(i.id)}`, {
                  signal,
                  authenticated: true,
                  expectedUser: user,
                });
                setCurrent({ id: i.id, revision: value.revision });
                setDraft(JSON.stringify(value.payload, null, 2));
                setValidated("");
              })
            }
          >
            读取并编辑
          </Button>
        </Glass>
      ))}
      <Pager
        page={page}
        hasMore={page * 10 < (r.data?.total || 0)}
        loading={r.loading}
        onChange={setPage}
      />
    </>
  );
}
export function AdminSourceEditor({
  user,
  source,
}: {
  user: string;
  source: "events" | "youtube" | "x";
}) {
  const paths = {
    events: "/admin/market-events",
    youtube: "/youtube-opinions",
    x: "/x-content",
  };
  const base = paths[source];
  const [draft, setDraft] = useState("");
  const [validated, setValidated] = useState("");
  const m = useMutation();
  return (
    <>
      <Section
        title={
          source === "events"
            ? "市场事件导入"
            : source === "youtube"
              ? "YouTube 内容管理"
              : "X 内容管理"
        }
      />
      <Copy muted>
        按 Web 的现有导入格式提交完整
        JSON。先验证，核对后再保存；接口保留原有重复与版本校验。
      </Copy>
      <Field
        editable={!m.busy}
        label="导入 JSON"
        value={draft}
        onChangeText={(v) => {
          setDraft(v);
          setValidated("");
        }}
        multiline
        maxLength={1000000}
        style={{ minHeight: 240 }}
      />
      <Button
        disabled={m.busy || !draft.trim()}
        onPress={() =>
          void m.run(async (signal) => {
            await apiRequest(`${base}/validate`, {
              method: "POST",
              body: document(draft),
              signal,
              authenticated: true,
              expectedUser: user,
            });
            setValidated(draft);
          })
        }
      >
        验证内容
      </Button>
      <Button
        disabled={m.busy || !validated || validated !== draft}
        onPress={() =>
          void m.run(async (signal) => {
            await apiRequest(source === "events" ? base : `${base}/upload`, {
              method: "POST",
              body: document(draft),
              signal,
              authenticated: true,
              expectedUser: user,
            });
            setValidated("");
          })
        }
      >
        保存已验证内容
      </Button>
      <MutationStatus {...m} />
      {source === "youtube" ? (
        <CreatorAdmin user={user} />
      ) : source === "x" ? (
        <XCreatorAdmin user={user} />
      ) : (
        <EventPreview user={user} />
      )}
    </>
  );
}
function EventPreview({ user }: { user: string }) {
  const [page, setPage] = useState(1);
  const r = useResource(`admin-events:${user}:${page}`, (signal) =>
    apiRequest<{
      events: {
        id: string;
        title: string;
        event_date: string;
        status: string;
      }[];
      total: number;
    }>(`/admin/market-events?page=${page}`, {
      signal,
      authenticated: true,
      expectedUser: user,
    }),
  );
  return (
    <>
      <ResourceState
        skeleton={<ResultRowsSkeleton count={6} />}
        resource={r}
        empty={!r.data?.events.length}
        message="暂无市场事件"
      />
      {r.data?.events.map((e) => (
        <Copy key={e.id}>
          {e.event_date} · {e.title} · {e.status}
        </Copy>
      ))}
      <Pager
        page={page}
        hasMore={page * 50 < (r.data?.total || 0)}
        loading={r.loading}
        onChange={setPage}
      />
    </>
  );
}
function XCreatorAdmin({ user }: { user: string }) {
  const [draft, setDraft] = useState("");
  const m = useMutation();
  return (
    <>
      <Section title="X 博主资料" />
      <Copy muted>
        JSON
        字段：username、display_name、bio、avatar_url、location、website、followers_count、following_count。
      </Copy>
      <Field
        editable={!m.busy}
        label="博主资料 JSON"
        value={draft}
        onChangeText={setDraft}
        multiline
        style={{ minHeight: 160 }}
      />
      <Button
        disabled={m.busy || !draft.trim()}
        onPress={() =>
          void m.run(async (signal) => {
            await apiRequest("/x-content/creators", {
              method: "POST",
              body: document(draft),
              signal,
              authenticated: true,
              expectedUser: user,
            });
          })
        }
      >
        保存博主资料
      </Button>
      <MutationStatus {...m} />
    </>
  );
}
function CreatorAdmin({ user }: { user: string }) {
  const r = useResource(`admin-creators:${user}`, (signal) =>
    apiRequest<{
      creators: {
        channel_id: string;
        channel_title: string;
        channel_handle?: string;
        channel_url?: string;
        channel_avatar_url?: string;
      }[];
    }>("/youtube-opinions/creators", {
      signal,
      authenticated: true,
      expectedUser: user,
    }),
  );
  const [channel, setChannel] = useState("");
  const [identity, setIdentity] = useState("");
  const [draft, setDraft] = useState("");
  const [id, setId] = useState("");
  const m = useMutation();
  const history = useResource(`admin-opinions:${channel}`, (signal) =>
    channel
      ? apiRequest<{ opinions: Record<string, unknown>[] }>(
          `/youtube-opinions/creators/${encodeURIComponent(channel)}/opinions`,
          { signal, authenticated: true, expectedUser: user },
        )
      : Promise.resolve({ opinions: [] }),
  );
  return (
    <>
      <Section title="频道与观点编辑" />
      <ResourceState
        skeleton={<ButtonsSkeleton count={4} />}
        resource={r}
        empty={!r.data?.creators.length}
        message="暂无频道"
      />
      {r.data?.creators.map((c) => (
        <Button
          key={c.channel_id}
          onPress={() => {
            setChannel(c.channel_id);
            const {
              channel_title,
              channel_handle,
              channel_url,
              channel_avatar_url,
            } = c;
            setIdentity(
              JSON.stringify(
                {
                  channel_title,
                  channel_handle,
                  channel_url,
                  channel_avatar_url,
                },
                null,
                2,
              ),
            );
            setId("");
            setDraft("");
          }}
        >
          {c.channel_title}
        </Button>
      ))}
      {channel && (
        <>
          <Field
            editable={!m.busy}
            label="频道资料 JSON"
            value={identity}
            onChangeText={setIdentity}
            multiline
            style={{ minHeight: 140 }}
          />
          <Button
            disabled={m.busy}
            onPress={() =>
              void m.run(async (signal) => {
                await apiRequest(
                  `/youtube-opinions/creators/${encodeURIComponent(channel)}`,
                  {
                    method: "PATCH",
                    body: document(identity),
                    signal,
                    authenticated: true,
                    expectedUser: user,
                  },
                );
                r.refresh();
              })
            }
          >
            保存频道资料
          </Button>
          <Copy muted>
            观点字段：ticker、summary、sentiment、direction_score、confidence、opinion_date、thesis、key_points、risks、price_targets、video_title、video_url、video_published_at。
          </Copy>
          <Field
            editable={!m.busy}
            label={id ? "编辑观点 JSON" : "新增观点 JSON"}
            value={draft}
            onChangeText={setDraft}
            multiline
            style={{ minHeight: 180 }}
          />
          <Button
            disabled={m.busy || !draft.trim()}
            onPress={() =>
              void m.run(async (signal) => {
                await apiRequest(
                  id
                    ? `/youtube-opinions/opinions/${encodeURIComponent(id)}`
                    : `/youtube-opinions/creators/${encodeURIComponent(channel)}/opinions`,
                  {
                    method: id ? "PATCH" : "POST",
                    body: document(draft),
                    signal,
                    authenticated: true,
                    expectedUser: user,
                  },
                );
                setId("");
                setDraft("");
                history.refresh();
              })
            }
          >
            {id ? "保存观点修改" : "新增观点"}
          </Button>
          <Button
            onPress={() => {
              setId("");
              setDraft("");
            }}
          >
            切换到新增观点
          </Button>
          <ResourceState
            skeleton={
              <CardsSkeleton
                lines={[{ size: 16, width: "60%", lines: 2 }]}
                buttons={1}
                padding={16}
                gap={8}
              />
            }
            resource={history}
            empty={!history.data?.opinions.length}
            message="暂无观点"
          />
          {history.data?.opinions.map((o) => (
            <Glass key={String(o.id)} style={{ padding: 16, gap: 8 }}>
              <Copy>
                {String(o.ticker)} · {String(o.summary || "")}
              </Copy>
              <Button
                onPress={() => {
                  setId(String(o.id));
                  const fields = [
                    "ticker",
                    "company_name",
                    "sentiment",
                    "direction_score",
                    "confidence",
                    "time_horizon",
                    "thesis",
                    "summary",
                    "key_points",
                    "risks",
                    "price_targets",
                    "opinion_date",
                    "video_title",
                    "video_url",
                    "video_published_at",
                  ];
                  setDraft(
                    JSON.stringify(
                      Object.fromEntries(
                        fields
                          .filter((k) => o[k] !== undefined)
                          .map((k) => [k, o[k]]),
                      ),
                      null,
                      2,
                    ),
                  );
                }}
              >
                编辑观点
              </Button>
              <ConfirmAction
                label="删除观点"
                description="此观点将永久删除，无法恢复。"
                disabled={m.busy}
                onConfirm={() =>
                  void m.run(async (signal) => {
                    await apiRequest(
                      `/youtube-opinions/opinions/${encodeURIComponent(String(o.id))}`,
                      {
                        method: "DELETE",
                        signal,
                        authenticated: true,
                        expectedUser: user,
                      },
                    );
                    history.refresh();
                  })
                }
              />
            </Glass>
          ))}
        </>
      )}
      <MutationStatus {...m} />
    </>
  );
}
