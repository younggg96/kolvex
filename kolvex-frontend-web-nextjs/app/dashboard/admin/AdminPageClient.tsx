"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  Database,
  Bot,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Newspaper,
  MessageSquare,
  Activity,
  Shield,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface OverviewData {
  users: {
    total: number;
    new_today: number;
  };
  twitter: {
    total_kols: number;
    total_tweets: number;
  };
  xiaohongshu: {
    total_posts: number;
    stock_related_posts: number;
  };
  news: {
    total_articles: number;
  };
  engagement: {
    stock_trackings: number;
    kol_subscriptions: number;
  };
  updated_at: string;
}

interface ScraperStatus {
  twitter: {
    platform: string;
    cookies_available: boolean;
    supabase_connected: boolean;
    active_kol_count: number;
    status: string;
  };
  xiaohongshu: {
    platform: string;
    is_logged_in: boolean;
    cookies_available: boolean;
    cookies_count: number;
    supabase_connected: boolean;
    total_posts: number;
    stock_related_posts: number;
    default_keywords: string[];
    status: string;
  };
  updated_at: string;
}

interface UserProfile {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  membership: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface UsersData {
  users: UserProfile[];
  total: number;
  page: number;
  page_size: number;
}

interface DatabaseStats {
  tables: Record<string, number | string>;
  updated_at: string;
}

// Stats Card Component
function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        {subtitle && (
          <p
            className={cn(
              "text-xs",
              trend === "up"
                ? "text-green-500"
                : trend === "down"
                ? "text-red-500"
                : "text-muted-foreground"
            )}
          >
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Scraper Status Card Component
function ScraperStatusCard({
  name,
  platform,
  status,
  details,
}: {
  name: string;
  platform: string;
  status: "ready" | "needs_login" | "error";
  details: Record<string, any>;
}) {
  const statusConfig = {
    ready: {
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      label: "Ready",
    },
    needs_login: {
      icon: AlertCircle,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      label: "Needs Login",
    },
    error: {
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      label: "Error",
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <Card className="bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{name}</CardTitle>
          <Badge
            variant="outline"
            className={cn(config.bgColor, config.color, "border-0")}
          >
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(details).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span className="text-muted-foreground capitalize">
                {key.replace(/_/g, " ")}:
              </span>
              <span className="font-medium">
                {typeof value === "boolean" ? (value ? "Yes" : "No") : value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPageClient() {
  const router = useRouter();
  const { profile, isLoading: profileLoading } = useUserProfileContext();

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [scrapers, setScrapers] = useState<ScraperStatus | null>(null);
  const [users, setUsers] = useState<UsersData | null>(null);
  const [database, setDatabase] = useState<DatabaseStats | null>(null);

  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingScrapers, setIsLoadingScrapers] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingDatabase, setIsLoadingDatabase] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    if (!profileLoading && profile && !profile.is_admin) {
      router.push("/dashboard");
    }
  }, [profile, profileLoading, router]);

  // Fetch overview data
  const fetchOverview = useCallback(async () => {
    setIsLoadingOverview(true);
    try {
      const response = await fetch("/api/admin/overview");
      if (!response.ok) {
        if (response.status === 403) {
          router.push("/dashboard");
          return;
        }
        throw new Error("Failed to fetch overview");
      }
      const data = await response.json();
      setOverview(data);
    } catch (err) {
      setError("Failed to fetch overview data");
      console.error(err);
    } finally {
      setIsLoadingOverview(false);
    }
  }, [router]);

  // Fetch scrapers status
  const fetchScrapers = useCallback(async () => {
    setIsLoadingScrapers(true);
    try {
      const response = await fetch("/api/admin/scrapers");
      if (!response.ok) {
        throw new Error("Failed to fetch scrapers status");
      }
      const data = await response.json();
      setScrapers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingScrapers(false);
    }
  }, []);

  // Fetch users
  const fetchUsers = useCallback(
    async (page: number = 1, search: string = "") => {
      setIsLoadingUsers(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          page_size: "20",
        });
        if (search) {
          params.set("search", search);
        }
        const response = await fetch(`/api/admin/users?${params}`);
        if (!response.ok) {
          throw new Error("Failed to fetch users");
        }
        const data = await response.json();
        setUsers(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingUsers(false);
      }
    },
    []
  );

  // Fetch database stats
  const fetchDatabase = useCallback(async () => {
    setIsLoadingDatabase(true);
    try {
      const response = await fetch("/api/admin/database");
      if (!response.ok) {
        throw new Error("Failed to fetch database stats");
      }
      const data = await response.json();
      setDatabase(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDatabase(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    if (profile?.is_admin) {
      fetchOverview();
      fetchScrapers();
      fetchUsers(1);
      fetchDatabase();
    }
  }, [profile, fetchOverview, fetchScrapers, fetchUsers, fetchDatabase]);

  // Search users with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (profile?.is_admin) {
        fetchUsers(1, searchQuery);
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchUsers, profile]);

  // Loading state
  if (profileLoading) {
    return (
      <DashboardLayout title="Admin Dashboard">
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Not admin - will redirect
  if (!profile?.is_admin) {
    return (
      <DashboardLayout title="Admin Dashboard">
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You don&apos;t have permission to access this page.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Admin Dashboard">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground">
                System overview and management
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchOverview();
                fetchScrapers();
                fetchUsers(currentPage, searchQuery);
                fetchDatabase();
              }}
              disabled={
                isLoadingOverview ||
                isLoadingScrapers ||
                isLoadingUsers ||
                isLoadingDatabase
              }
            >
              <RefreshCw
                className={cn(
                  "h-4 w-4 mr-2",
                  (isLoadingOverview ||
                    isLoadingScrapers ||
                    isLoadingUsers ||
                    isLoadingDatabase) &&
                    "animate-spin"
                )}
              />
              Refresh
            </Button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg p-4">
              {error}
            </div>
          )}

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="scrapers">Scrapers</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="database">Database</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {isLoadingOverview ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : overview ? (
                <>
                  {/* User Stats */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">User Stats</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <StatsCard
                        title="Total Users"
                        value={overview.users.total}
                        subtitle={`+${overview.users.new_today} today`}
                        icon={Users}
                        trend="up"
                      />
                      <StatsCard
                        title="Stock Trackings"
                        value={overview.engagement.stock_trackings}
                        icon={TrendingUp}
                      />
                      <StatsCard
                        title="KOL Subscriptions"
                        value={overview.engagement.kol_subscriptions}
                        icon={Activity}
                      />
                      <StatsCard
                        title="News Articles"
                        value={overview.news.total_articles}
                        icon={Newspaper}
                      />
                    </div>
                  </div>

                  {/* Platform Stats */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">
                      Platform Stats
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <StatsCard
                        title="Twitter KOLs"
                        value={overview.twitter.total_kols}
                        subtitle={`${overview.twitter.total_tweets.toLocaleString()} tweets`}
                        icon={MessageSquare}
                      />
                      <StatsCard
                        title="XHS Posts"
                        value={overview.xiaohongshu.total_posts}
                        subtitle={`${overview.xiaohongshu.stock_related_posts} stock related`}
                        icon={MessageSquare}
                      />
                    </div>
                  </div>
                </>
              ) : null}
            </TabsContent>

            {/* Scrapers Tab */}
            <TabsContent value="scrapers" className="space-y-6">
              {isLoadingScrapers ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : scrapers ? (
                <div className="grid gap-6 md:grid-cols-2">
                  <ScraperStatusCard
                    name="Twitter Scraper"
                    platform="twitter"
                    status={scrapers.twitter.status as any}
                    details={{
                      "Cookies Available": scrapers.twitter.cookies_available,
                      "Supabase Connected": scrapers.twitter.supabase_connected,
                      "Active KOLs": scrapers.twitter.active_kol_count,
                    }}
                  />
                  <ScraperStatusCard
                    name="Xiaohongshu Scraper"
                    platform="xiaohongshu"
                    status={scrapers.xiaohongshu.status as any}
                    details={{
                      "Logged In": scrapers.xiaohongshu.is_logged_in,
                      "Supabase Connected":
                        scrapers.xiaohongshu.supabase_connected,
                      "Total Posts": scrapers.xiaohongshu.total_posts,
                      "Stock Related": scrapers.xiaohongshu.stock_related_posts,
                    }}
                  />
                </div>
              ) : null}
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by email or username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {users && (
                  <span className="text-sm text-muted-foreground">
                    {users.total} total users
                  </span>
                )}
              </div>

              {isLoadingUsers ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : users && users.users.length > 0 ? (
                <>
                  <Card className="bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Membership</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Created</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                {user.avatar_url ? (
                                  <img
                                    src={user.avatar_url}
                                    alt={user.username || "User"}
                                    className="h-8 w-8 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Users className="h-4 w-4 text-primary" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium">
                                    {user.username || user.full_name || "—"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {user.id.slice(0, 8)}...
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.membership}</Badge>
                            </TableCell>
                            <TableCell>
                              {user.is_admin ? (
                                <Badge className="bg-primary/10 text-primary border-0">
                                  <Shield className="h-3 w-3 mr-1" />
                                  Admin
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">
                                  User
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(user.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>

                  {/* Pagination */}
                  {users.total > users.page_size && (
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newPage = currentPage - 1;
                          setCurrentPage(newPage);
                          fetchUsers(newPage, searchQuery);
                        }}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-muted-foreground">
                        Page {currentPage} of{" "}
                        {Math.ceil(users.total / users.page_size)}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newPage = currentPage + 1;
                          setCurrentPage(newPage);
                          fetchUsers(newPage, searchQuery);
                        }}
                        disabled={
                          currentPage >=
                          Math.ceil(users.total / users.page_size)
                        }
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  No users found
                </div>
              )}
            </TabsContent>

            {/* Database Tab */}
            <TabsContent value="database" className="space-y-6">
              {isLoadingDatabase ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : database ? (
                <Card className="bg-card-light dark:bg-card-dark border-border-light dark:border-border-dark">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Database Tables
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Table Name</TableHead>
                          <TableHead className="text-right">
                            Row Count
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(database.tables)
                          .sort((a, b) => {
                            const aVal =
                              typeof a[1] === "number" ? a[1] : -1;
                            const bVal =
                              typeof b[1] === "number" ? b[1] : -1;
                            return bVal - aVal;
                          })
                          .map(([table, count]) => (
                            <TableRow key={table}>
                              <TableCell className="font-mono text-sm">
                                {table}
                              </TableCell>
                              <TableCell className="text-right">
                                {typeof count === "number"
                                  ? count.toLocaleString()
                                  : count}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </DashboardLayout>
  );
}
