import { useState } from "react";
import { CardsSkeleton } from "../../../components/Skeletons";
import { apiRequest } from "../../../lib/http";
import { profile } from "../../../lib/contentApi";
import { useAuth } from "../../../state/Auth";
import { useResource } from "../../../lib/useResource";
import { useMutation } from "../../../lib/useMutation";
import { Page, Copy, Button, Glass } from "../../../components/UI";
import {
  AuthGate,
  Field,
  Filters,
  Pager,
  ResourceState,
} from "../../../components/Content";
import { ConfirmAction } from "../../../components/ConfirmAction";
import { MutationStatus } from "../../../components/MutationStatus";
import {
  AdminBriefs,
  AdminSourceEditor,
} from "../../../components/AdminEditors";
import { OptionsActivityAdmin } from "../../../components/OptionsActivityAdmin";
export default function Admin() {
  return (
    <AuthGate
      skeleton={<CardsSkeleton count={2} lines={[{ size: 16 }]} padding={16} />}
      title="管理中心"
    >
      <Gate />
    </AuthGate>
  );
}
function Gate() {
  const user = useAuth().session!.user.id;
  const r = useResource(`admin-profile:${user}`, (s) => profile(user, s));
  if (!r.data)
    return (
      <Page title="管理中心">
        <ResourceState
          skeleton={
            <CardsSkeleton count={2} lines={[{ size: 16 }]} padding={16} />
          }
          resource={r}
          empty={false}
          message="读取权限中"
        />
      </Page>
    );
  return r.data.is_admin ? (
    <AdminContent user={user} />
  ) : (
    <Page title="管理中心">
      <Copy>此账户没有管理员权限。</Copy>
    </Page>
  );
}
function AdminContent({ user }: { user: string }) {
  const [tab, setTab] = useState("overview");
  return (
    <Page
      title="管理中心"
      subtitle="仅使用现有管理员权限；所有写入仍由服务器校验。"
    >
      <Filters
        values={[
          ["overview", "概览"],
          ["users", "用户"],
          ["briefs", "日报"],
          ["events", "市场事件"],
          ["youtube", "YouTube"],
          ["x", "X 内容"],
          ["options", "期权异动"],
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "overview" ? (
        <Overview user={user} />
      ) : tab === "users" ? (
        <Users user={user} />
      ) : tab === "briefs" ? (
        <AdminBriefs user={user} />
      ) : tab === "options" ? (
        <OptionsActivityAdmin user={user} />
      ) : (
        <AdminSourceEditor
          key={tab}
          user={user}
          source={tab as "events" | "youtube" | "x"}
        />
      )}
    </Page>
  );
}
function Overview({ user }: { user: string }) {
  const r = useResource(`admin-overview:${user}`, (signal) =>
    apiRequest<{ tables: Record<string, number> }>("/admin/overview", {
      signal,
      authenticated: true,
      expectedUser: user,
    }),
  );
  return (
    <>
      <ResourceState
        skeleton={
          <CardsSkeleton count={4} lines={[{ size: 16 }]} padding={16} />
        }
        resource={r}
        empty={!r.data}
        message="没有概览数据"
      />
      {Object.entries(r.data?.tables || {}).map(([name, count]) => (
        <Glass key={name} style={{ padding: 16 }}>
          <Copy>
            {name} · {count}
          </Copy>
        </Glass>
      ))}
      <Button onPress={r.refresh}>刷新概览</Button>
    </>
  );
}
function Users({ user }: { user: string }) {
  const [page, setPage] = useState(1);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const m = useMutation();
  const r = useResource(`admin-users:${user}:${page}:${search}`, (signal) =>
    apiRequest<{
      users: {
        id: string;
        email: string;
        username?: string;
        is_admin: boolean;
        membership: string;
      }[];
      total: number;
    }>(
      `/admin/users?page=${page}&page_size=20&search=${encodeURIComponent(search)}`,
      { signal, authenticated: true, expectedUser: user },
    ),
  );
  return (
    <>
      <Field label="搜索邮箱或用户名" value={input} onChangeText={setInput} />
      <Button
        onPress={() => {
          setSearch(input.trim());
          setPage(1);
        }}
      >
        搜索
      </Button>
      <ResourceState
        skeleton={
          <CardsSkeleton
            lines={[{ size: 16 }, { size: 16, width: "50%" }]}
            buttons={1}
          />
        }
        resource={r}
        empty={!r.data?.users.length}
        message="无匹配用户"
      />
      {r.data?.users.map((u) => (
        <Glass key={u.id} style={{ padding: 20, gap: 12 }}>
          <Copy bold>{u.username || u.email}</Copy>
          <Copy muted>
            {u.email} · {u.membership} · {u.is_admin ? "管理员" : "用户"}
          </Copy>
          <ConfirmAction
            disabled={m.busy || u.id === user}
            label={u.is_admin ? "取消管理员" : "授予管理员"}
            description={`${u.email} 的管理权限将被${u.is_admin ? "移除" : "开启，可访问管理数据并修改产品内容"}。请核对目标账户。`}
            onConfirm={() =>
              void m.run(async (signal) => {
                await apiRequest(
                  `/admin/users/${u.id}/admin?is_admin=${!u.is_admin}`,
                  {
                    method: "PATCH",
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
      <MutationStatus {...m} />
      <Pager
        page={page}
        hasMore={page * 20 < (r.data?.total || 0)}
        loading={r.loading}
        onChange={setPage}
      />
    </>
  );
}
