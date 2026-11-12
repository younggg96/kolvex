"use client";

import { ContentLoading } from "@/components/ui/content-loading";
import { Skeleton } from "@/components/ui/skeleton";
import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import MarketEventManager from "@/components/admin/MarketEventManager";
import DailyBriefImporter from "@/components/admin/DailyBriefImporter";
import YouTubeOpinionImporter from "@/components/admin/YouTubeOpinionImporter";
import YouTubeCreatorManager from "@/components/admin/YouTubeCreatorManager";
import XContentManager from "@/components/admin/XContentManager";
import OptionsActivityManager from "@/components/admin/OptionsActivityManager";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdminUser { id: string; email: string; username?: string; is_admin: boolean }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.detail || "请求失败");
  return result;
}

export default function AdminPageClient({ initialTab }: { initialTab?: string }) {
  const { profile, isLoading } = useUserProfileContext();
  const [tables, setTables] = useState<Record<string, number>>({});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!profile?.is_admin) return;
    setBusy(true);
    setError("");
    try {
      const [database, userList] = await Promise.all([
        request<{ tables: Record<string, number> }>("/api/admin/database"),
        request<{ users: AdminUser[]; total: number }>(`/api/admin/users?page=${page}&page_size=25&search=${encodeURIComponent(search)}`),
      ]);
      setTables(database.tables);
      setUsers(userList.users);
      setTotal(userList.total);
    } catch (e) { setError(e instanceof Error ? e.message : "加载失败"); }
    finally { setBusy(false); }
  }, [profile?.is_admin, page, search]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function proxyAction(path: string, method = "POST") {
    setBusy(true);
    setError("");
    try {
      await request("/api/admin/proxy", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path, method, body: {} }),
      });
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "操作失败"); }
    finally { setBusy(false); }
  }

  if (isLoading) return <DashboardLayout title="管理后台"><ContentLoading label="正在加载管理后台" className="mx-auto min-h-0 w-full px-[16px] pb-8 pt-6 md:px-8 md:pt-8">
    <div className="space-y-8">
      <Skeleton className="h-4 w-32 rounded-md" />
      <div className="grid grid-cols-3 border-y border-border">{[0, 1, 2].map(i => <div key={i} className="flex flex-col gap-2 py-4 pr-4"><Skeleton className="h-3.5 w-14 rounded-md" /><Skeleton className="h-6 w-16 rounded-md" /></div>)}</div>
      <div className="flex flex-wrap gap-1">{[0, 1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-10 w-20 rounded-full" />)}</div>
      <div><div className="border-b border-border py-2.5"><Skeleton className="h-3.5 w-full rounded-md" /></div>{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="flex justify-between border-b border-border py-3"><Skeleton className={i % 2 ? "h-4 w-32 rounded-md" : "h-4 w-48 rounded-md"} /><Skeleton className="h-4 w-12 rounded-md" /></div>)}</div>
    </div>
  </ContentLoading></DashboardLayout>;
  if (!profile?.is_admin) return <DashboardLayout title="管理后台"><p className="mx-auto  px-[16px] py-8 text-muted-foreground md:px-8">需要管理员权限。</p></DashboardLayout>;

  const tableCount = Object.keys(tables).length;
  const recordCount = Object.values(tables).reduce((sum, count) => sum + count, 0);

  return (
    <DashboardLayout title="管理后台">
      <div className="mx-auto min-h-0 w-full  flex-1 space-y-8 overflow-y-auto overscroll-contain px-[16px] pb-8 pt-6 md:px-8 md:pt-8">
        <p className="text-[0.9375rem] text-muted-foreground">管理用户与研究数据</p>

        <dl className="grid grid-cols-3 border-y border-border">
          {[
            { label: "数据表", value: tableCount },
            { label: "记录总数", value: recordCount },
            { label: "用户", value: total },
          ].map((item) => (
            <div key={item.label} className="py-4 pr-4">
              <dt className="text-[0.8125rem] text-muted-foreground">{item.label}</dt>
              <dd className="figure mt-1 text-xl font-semibold">{item.value.toLocaleString()}</dd>
            </div>
          ))}
        </dl>

        {error && <p role="alert" className="rounded-3xl bg-negative/10 px-4 py-3 text-sm text-foreground">{error}</p>}

        <Tabs defaultValue={initialTab === "x" ? "x" : initialTab === "events" ? "events" : initialTab === "briefs" ? "briefs" : initialTab === "options" ? "options" : "database"}>
          <TabsList className="max-w-full flex-wrap h-auto">
            <TabsTrigger value="database">数据库</TabsTrigger>
            <TabsTrigger value="users">用户</TabsTrigger>
            <TabsTrigger value="creators">博主观点</TabsTrigger>
            <TabsTrigger value="youtube">YouTube 导入</TabsTrigger>
            <TabsTrigger value="x">X 内容</TabsTrigger>
            <TabsTrigger value="events">重大事件</TabsTrigger>
            <TabsTrigger value="briefs">日报管理</TabsTrigger>
            <TabsTrigger value="options">期权异动</TabsTrigger>
          </TabsList>

          <TabsContent value="database" className="mt-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[0.8125rem] text-muted-foreground">
                    <th className="py-2.5 font-medium">表</th>
                    <th className="py-2.5 text-right font-medium">记录数</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.entries(tables).map(([name, count]) => (
                    <tr key={name}>
                      <td className="break-all py-3 pr-4 font-mono text-[0.8125rem]">{name}</td>
                      <td className="figure whitespace-nowrap py-3 text-right">{count.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6 space-y-4">
            <SearchInput
              aria-label="搜索用户"
              placeholder="搜索邮箱或用户名"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              containerClassName="w-full max-w-md"
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[0.8125rem] text-muted-foreground">
                    <th className="py-2.5 font-medium">邮箱</th>
                    <th className="py-2.5 font-medium">用户名</th>
                    <th className="py-2.5 text-right font-medium">权限</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="py-3 pr-4">{user.email}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{user.username || "—"}</td>
                      <td className="py-2 text-right">
                        <span className="inline-flex items-center gap-2">
                          {user.is_admin && <span className="rounded-full bg-positive/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-positive">管理员</span>}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy || user.id === profile.id}
                            onClick={() => void proxyAction(`/api/v1/admin/users/${user.id}/admin?is_admin=${!user.is_admin}`, "PATCH")}
                          >
                            {user.is_admin ? "取消管理员" : "设为管理员"}
                          </Button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <span className="figure text-sm text-muted-foreground">第 {page} 页 · 共 {total} 人</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={busy || page === 1} onClick={() => setPage(page - 1)}>上一页</Button>
                <Button variant="outline" size="sm" disabled={busy || page * 25 >= total} onClick={() => setPage(page + 1)}>下一页</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="events" forceMount className="mt-6 data-[state=inactive]:hidden"><MarketEventManager /></TabsContent>
          <TabsContent value="options" className="mt-6">
            <OptionsActivityManager />
          </TabsContent>
          <TabsContent value="briefs" className="mt-6">
            <DailyBriefImporter />
          </TabsContent>
          <TabsContent value="youtube" className="mt-6">
            <YouTubeOpinionImporter onImported={() => void refresh()} />
          </TabsContent>
          <TabsContent value="x" className="mt-6">
            <XContentManager onSaved={() => void refresh()} />
          </TabsContent>
          <TabsContent value="creators" className="mt-6">
            <YouTubeCreatorManager />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
