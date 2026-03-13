"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SectionCard from "@/components/layout/SectionCard";
import { useUserProfileContext } from "@/components/user/UserProfileProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SwitchTab } from "@/components/ui/switch-tab";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent } from "@/components/ui/tabs";
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
  Activity,
  Shield,
  Loader2,
  LayoutDashboard,
  UserCog,
  HardDrive,
  Clock,
  Play,
  Zap,
  Brain,
  Download,
  MessageSquare,
  UserPlus,
  ExternalLink,
  AtSign,
  Camera,
  CalendarClock,
  Timer,
  Pause,
  Settings2,
  RotateCw,
  Power,
  PowerOff,
  Settings,
  Crown,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// User Avatar with error handling - uses Next.js Image for caching
const UserAvatar = memo(function UserAvatar({
  src,
  fallback,
}: {
  src?: string;
  fallback: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-medium text-muted-foreground">
          {fallback}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt=""
      width={28}
      height={28}
      className="h-7 w-7 rounded-full object-cover flex-shrink-0"
      onError={() => setHasError(true)}
      unoptimized={!src.includes("googleusercontent.com")}
    />
  );
});

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

interface ScraperTask {
  task_id: string;
  platform: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  duration_human?: string;
  error?: string;
  stats?: Record<string, any>;
  usernames?: string[];
  categories?: string[];
}

interface TasksData {
  tasks: ScraperTask[];
  twitter_count: number;
  xiaohongshu_count: number;
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

interface KOLTrackingRequest {
  id: string;
  user_id: string;
  platform: string;
  platform_user_id: string;
  status: "pending" | "approved" | "rejected";
  user_notes?: string;
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  user_email?: string;
  user_username?: string;
  user_avatar_url?: string;
}

interface KOLRequestsData {
  requests: KOLTrackingRequest[];
  total: number;
}

interface AIAnalysisStats {
  success: boolean;
  platform: string;
  total_posts: number;
  analyzed_posts: number;
  unanalyzed_posts: number;
  stock_related_posts: number;
  sentiment_distribution: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  analysis_rate: number;
  updated_at: string;
}

interface AITask {
  task_id: string;
  task_type: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  platform: string;
  total_posts: number;
  batch_size: number;
  analyzed_count: number;
  failed_count: number;
  skipped_count: number;
  current_batch: number;
  progress_percent: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
  duration_human?: string;
  last_update: string;
}

interface AdminKOL {
  id: number;
  platform: string;
  platform_user_id?: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  location?: string;
  website?: string;
  profile_url?: string;
  is_verified: boolean;
  verification_type?: string;
  followers_count: number;
  following_count: number;
  likes_count: number;
  collected_count: number;
  rest_id?: string;
  red_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  posts_count?: number;
  subscribers_count?: number;
}

interface AdminKOLsData {
  kols: AdminKOL[];
  total: number;
  page: number;
  page_size: number;
}

interface ScheduledJob {
  id: string;
  name: string;
  next_run_time: string | null;
  trigger_type: string;
  trigger_details: string;
  trigger_config?: {
    type?: "interval" | "cron" | "unknown";
    hours?: number;
    hour?: string | number | null;
    minute?: string | number | null;
    timezone?: string | null;
  };
  is_paused?: boolean;
}

interface SchedulerData {
  is_running: boolean;
  jobs_count: number;
  jobs: ScheduledJob[];
}

// Predefined scheduled jobs info for display
interface ScheduledJobConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  frequency: string;
  category: "news" | "scraper" | "sync";
  actionEndpoint?: string;
}

const adminTabs = [
  { value: "overview", icon: LayoutDashboard, label: "Overview" },
  { value: "kols", icon: Crown, label: "KOLs" },
  { value: "scheduler", icon: CalendarClock, label: "Scheduler" },
  { value: "actions", icon: Zap, label: "Actions" },
  { value: "kol-requests", icon: UserPlus, label: "KOL Requests" },
  { value: "scrapers", icon: Bot, label: "Scrapers" },
  { value: "users", icon: UserCog, label: "Users" },
  { value: "database", icon: HardDrive, label: "Database" },
];

// Scheduled jobs configuration - maps job IDs to display info
const scheduledJobsConfig: ScheduledJobConfig[] = [
  {
    id: "fetch_kol_news",
    name: "KOL News Fetch",
    description: "Fetch news articles for KOL-related stock tickers",
    icon: Newspaper,
    frequency: "Every 1 hour",
    category: "news",
    actionEndpoint: "fetch-news",
  },
  {
    id: "fetch_bulk_news",
    name: "Bulk News Fetch",
    description: "Fetch all latest news articles (no ticker filter)",
    icon: Newspaper,
    frequency: "Every 1 hour",
    category: "news",
    actionEndpoint: "fetch-news",
  },
  {
    id: "scrape_kol_tweets",
    name: "KOL Posts Scrape",
    description: "Scrape Twitter and Xiaohongshu posts from active KOLs",
    icon: MessageSquare,
    frequency: "Every 2 hours",
    category: "scraper",
    actionEndpoint: "scrape-twitter",
  },
  {
    id: "daily_sync_holdings",
    name: "Morning Sync Holdings",
    description: "Sync all users' holdings data (08:00 UTC)",
    icon: Activity,
    frequency: "Daily at 08:00 UTC",
    category: "sync",
    actionEndpoint: "sync-holdings",
  },
  {
    id: "afternoon_sync_holdings",
    name: "Afternoon Sync Holdings",
    description: "Sync all users' holdings data (20:00 UTC / 4PM ET)",
    icon: Activity,
    frequency: "Daily at 20:00 UTC",
    category: "sync",
    actionEndpoint: "sync-holdings",
  },
  {
    id: "daily_portfolio_snapshot",
    name: "📸 Daily Portfolio Snapshot",
    description: "Record portfolio snapshots for profit curve (21:00 UTC)",
    icon: Camera,
    frequency: "Daily at 21:00 UTC",
    category: "sync",
    actionEndpoint: "portfolio-snapshot",
  },
];

// Action Button Component
interface ParamConfig {
  key: string;
  label: string;
  type: "number" | "select" | "text";
  default: any;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
}

interface ActionConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  action: string;
  params?: ParamConfig[];
  category: "scraper" | "analysis" | "sync";
}

const adminActions: ActionConfig[] = [
  {
    id: "scrape-twitter",
    name: "Scrape Twitter",
    description: "Fetch latest posts from all active KOLs",
    icon: MessageSquare,
    action: "scrape-twitter",
    params: [
      { key: "max_posts", label: "Posts per KOL", type: "number", default: 10, min: 1, max: 100 },
    ],
    category: "scraper",
  },
  {
    id: "scrape-xiaohongshu",
    name: "Scrape Xiaohongshu",
    description: "Fetch posts using default stock keywords",
    icon: Download,
    action: "scrape-xiaohongshu",
    params: [
      { key: "max_posts", label: "Posts per keyword", type: "number", default: 20, min: 1, max: 100 },
    ],
    category: "scraper",
  },
  {
    id: "fetch-news",
    name: "Fetch News",
    description: "Get latest news articles from Benzinga",
    icon: Newspaper,
    action: "fetch-news",
    params: [
      { key: "days", label: "Days", type: "number", default: 1, min: 1, max: 30 },
      { key: "limit", label: "Limit", type: "number", default: 100, min: 10, max: 500 },
    ],
    category: "scraper",
  },
  {
    id: "analyze-news",
    name: "Analyze News",
    description: "Run AI analysis on unanalyzed news",
    icon: Brain,
    action: "analyze-news",
    params: [
      { key: "limit", label: "Max articles", type: "number", default: 50, min: 1, max: 200 },
    ],
    category: "analysis",
  },
  {
    id: "analyze-posts",
    name: "Analyze Posts",
    description: "Run AI analysis on unanalyzed posts (batch)",
    icon: Brain,
    action: "analyze-posts",
    params: [
      {
        key: "platform",
        label: "Platform",
        type: "select",
        default: "all",
        options: [
          { value: "all", label: "All Platforms" },
          { value: "twitter", label: "Twitter" },
          { value: "xiaohongshu", label: "Xiaohongshu" },
        ],
      },
      { key: "limit", label: "Max posts", type: "number", default: 50, min: 1, max: 500 },
    ],
    category: "analysis",
  },
  {
    id: "analyze-all-posts",
    name: "Analyze ALL Posts",
    description: "Analyze all unanalyzed posts in background",
    icon: Brain,
    action: "analyze-all-posts",
    params: [
      {
        key: "platform",
        label: "Platform",
        type: "select",
        default: "all",
        options: [
          { value: "all", label: "All Platforms" },
          { value: "twitter", label: "Twitter" },
          { value: "xiaohongshu", label: "Xiaohongshu" },
        ],
      },
      { key: "batch_size", label: "Batch Size", type: "number", default: 100, min: 10, max: 500 },
      { key: "max_posts", label: "Max Posts", type: "number", default: 1000, min: 100, max: 10000 },
    ],
    category: "analysis",
  },
  {
    id: "sync-investors",
    name: "Sync Investors",
    description: "Sync super investor data from Dataroma",
    icon: TrendingUp,
    action: "sync-investors",
    category: "sync",
  },
  {
    id: "sync-holdings",
    name: "Sync Holdings",
    description: "Sync all users' portfolio holdings",
    icon: Activity,
    action: "sync-holdings",
    category: "sync",
  },
  {
    id: "portfolio-snapshot",
    name: "Portfolio Snapshot",
    description: "Record portfolio snapshots for all users (for P&L chart)",
    icon: Camera,
    action: "portfolio-snapshot",
    params: [
      {
        key: "sync_first",
        label: "Sync First",
        type: "select",
        default: "true",
        options: [
          { value: "true", label: "Yes - Sync holdings first" },
          { value: "false", label: "No - Use cached data" },
        ],
      },
    ],
    category: "sync",
  },
];

function ActionCard({
  config,
  onExecute,
  isExecuting,
  result,
}: {
  config: ActionConfig;
  onExecute: (action: string, params?: Record<string, any>) => void;
  isExecuting: boolean;
  result?: { success: boolean; message: string } | null;
}) {
  const Icon = config.icon;

  // Initialize params state with defaults
  const [params, setParams] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    config.params?.forEach((p) => {
      initial[p.key] = p.default;
    });
    return initial;
  });

  const updateParam = (key: string, value: any) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const hasParams = config.params && config.params.length > 0;

  return (
    <div className="bg-card border border-border rounded-lg p-2.5">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-medium text-foreground">
            {config.name}
          </h4>
          <p className="text-[11px] text-muted-foreground truncate">
            {config.description}
          </p>
        </div>
        <Button
          size="xs"
          onClick={() => onExecute(config.action, hasParams ? params : undefined)}
          disabled={isExecuting}
          className="h-6 px-2 gap-1"
        >
          {isExecuting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          <span className="text-[11px]">Run</span>
        </Button>
      </div>

      {/* Parameters */}
      {hasParams && (
        <div className="mt-2 pt-2 border-t border-border">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {config.params!.map((param) => (
              <div key={param.key} className="flex items-center gap-1">
                <label className="text-[11px] text-muted-foreground whitespace-nowrap">
                  {param.label}
                </label>
                {param.type === "number" && (
                  <Input
                    type="number"
                    value={params[param.key]}
                    onChange={(e) => updateParam(param.key, parseInt(e.target.value) || param.default)}
                    min={param.min}
                    max={param.max}
                    className="h-5 w-14 !text-[11px] px-2"
                  />
                )}
                {param.type === "select" && param.options && (
                  <Select
                    value={params[param.key]}
                    onValueChange={(value) => updateParam(param.key, value)}
                  >
                    <SelectTrigger className="h-5 w-auto min-w-[72px] !text-[11px] px-2 py-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {param.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value} className="!text-[12px] py-1">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {param.type === "text" && (
                  <Input
                    type="text"
                    value={params[param.key]}
                    onChange={(e) => updateParam(param.key, e.target.value)}
                    className="h-5 w-20 !text-[11px] px-2"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-2">
          <div
            className={cn(
              "text-[11px] px-2 py-1 rounded inline-flex items-center gap-1",
              result.success
                ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
            )}
          >
            {result.success ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            <span className="truncate">{result.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple Stats Card
function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-xl font-bold text-foreground mt-1">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

// Scraper Status Card
function ScraperStatusCard({
  name,
  status,
  stats,
  details,
}: {
  name: string;
  status: "ready" | "needs_login" | "error";
  stats: { label: string; value: number | string }[];
  details: { label: string; value: string | number | boolean }[];
}) {
  const statusConfig = {
    ready: {
      icon: CheckCircle2,
      color: "text-green-600 dark:text-green-500",
      label: "Ready",
    },
    needs_login: {
      icon: AlertCircle,
      color: "text-yellow-600 dark:text-yellow-500",
      label: "Needs Login",
    },
    error: {
      icon: XCircle,
      color: "text-red-600 dark:text-red-500",
      label: "Error",
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">{name}</h3>
          <div className={cn("flex items-center gap-1.5 text-xs", config.color)}>
            <StatusIcon className="h-3.5 w-3.5" />
            <span>{config.label}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
          {stats.map((stat, index) => (
            <div key={index} className="p-2 text-center">
              <p className="text-lg font-bold text-foreground">
                {typeof stat.value === "number"
                  ? stat.value.toLocaleString()
                  : stat.value}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Details */}
      <div className="p-3 space-y-1.5">
        {details.map((detail, index) => (
          <div key={index} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {detail.label}
            </span>
            <span className="text-foreground">
              {typeof detail.value === "boolean" ? (
                detail.value ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-500" />
                )
              ) : (
                detail.value
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPageClient() {
  const router = useRouter();
  const { profile, isLoading: profileLoading } = useUserProfileContext();

  const [activeTab, setActiveTab] = useState("overview");
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [scrapers, setScrapers] = useState<ScraperStatus | null>(null);
  const [tasks, setTasks] = useState<TasksData | null>(null);
  const [users, setUsers] = useState<UsersData | null>(null);
  const [database, setDatabase] = useState<DatabaseStats | null>(null);
  const [kolRequests, setKolRequests] = useState<KOLRequestsData | null>(null);

  // KOL management state
  const [adminKols, setAdminKols] = useState<AdminKOLsData | null>(null);
  const [isLoadingKols, setIsLoadingKols] = useState(true);
  const [kolSearch, setKolSearch] = useState("");
  const [kolPlatformFilter, setKolPlatformFilter] = useState("all");
  const [kolActiveFilter, setKolActiveFilter] = useState("all");
  const [kolPage, setKolPage] = useState(1);
  const [showKolDialog, setShowKolDialog] = useState(false);
  const [editingKol, setEditingKol] = useState<AdminKOL | null>(null);
  const [kolFormData, setKolFormData] = useState<Record<string, any>>({
    platform: "twitter",
    username: "",
    display_name: "",
    bio: "",
    avatar_url: "",
    profile_url: "",
    is_active: true,
  });
  const [isSavingKol, setIsSavingKol] = useState(false);
  const [deletingKolId, setDeletingKolId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteWithPosts, setDeleteWithPosts] = useState(false);
  const [togglingKolIds, setTogglingKolIds] = useState<Set<number>>(new Set());

  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingScrapers, setIsLoadingScrapers] = useState(true);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [isLoadingDatabase, setIsLoadingDatabase] = useState(true);
  const [isLoadingKolRequests, setIsLoadingKolRequests] = useState(true);

  const [kolRequestsFilter, setKolRequestsFilter] = useState<string>("all");
  const [reviewingRequests, setReviewingRequests] = useState<Set<string>>(
    new Set()
  );
  const [aiStats, setAiStats] = useState<AIAnalysisStats | null>(null);
  const [isLoadingAiStats, setIsLoadingAiStats] = useState(true);
  const [runningAiTask, setRunningAiTask] = useState<AITask | null>(null);
  const [isPollingTask, setIsPollingTask] = useState(false);
  const [schedulerData, setSchedulerData] = useState<SchedulerData | null>(null);
  const [isLoadingScheduler, setIsLoadingScheduler] = useState(true);
  const [schedulerEdits, setSchedulerEdits] = useState<
    Record<string, { intervalHours?: number; cronHour?: string; cronMinute?: string; timezone?: string }>
  >({});
  const [schedulerActions, setSchedulerActions] = useState<Set<string>>(new Set());
  const [schedulerResults, setSchedulerResults] = useState<
    Record<string, { ok: boolean; message: string }>
  >({});

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Actions state
  const [executingActions, setExecutingActions] = useState<Set<string>>(
    new Set()
  );
  const [actionResults, setActionResults] = useState<
    Record<string, { success: boolean; message: string }>
  >({});

  // Check admin access
  useEffect(() => {
    if (!profileLoading && profile && !profile.is_admin) {
      router.push("/dashboard");
    }
  }, [profile, profileLoading, router]);

  // Fetch functions
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

  const fetchScrapers = useCallback(async () => {
    setIsLoadingScrapers(true);
    try {
      const response = await fetch("/api/admin/scrapers");
      if (!response.ok) throw new Error("Failed to fetch scrapers status");
      const data = await response.json();
      setScrapers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingScrapers(false);
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    setIsLoadingTasks(true);
    try {
      const response = await fetch("/api/admin/tasks?limit=10");
      if (!response.ok) throw new Error("Failed to fetch tasks");
      const data = await response.json();
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingTasks(false);
    }
  }, []);

  const fetchUsers = useCallback(
    async (page: number = 1, search: string = "") => {
      setIsLoadingUsers(true);
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          page_size: "20",
        });
        if (search) params.set("search", search);
        const response = await fetch(`/api/admin/users?${params}`);
        if (!response.ok) throw new Error("Failed to fetch users");
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

  const fetchDatabase = useCallback(async () => {
    setIsLoadingDatabase(true);
    try {
      const response = await fetch("/api/admin/database");
      if (!response.ok) throw new Error("Failed to fetch database stats");
      const data = await response.json();
      setDatabase(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDatabase(false);
    }
  }, []);

  const fetchKolRequests = useCallback(async (statusFilter: string = "all") => {
    setIsLoadingKolRequests(true);
    try {
      let url = "/api/admin/kol-requests?limit=100";
      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch KOL requests");
      const data = await response.json();
      setKolRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingKolRequests(false);
    }
  }, []);

  const fetchAiStats = useCallback(async () => {
    setIsLoadingAiStats(true);
    try {
      const response = await fetch("/api/admin/ai-stats?platform=all");
      if (!response.ok) throw new Error("Failed to fetch AI stats");
      const data = await response.json();
      setAiStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAiStats(false);
    }
  }, []);

  const fetchScheduler = useCallback(async () => {
    setIsLoadingScheduler(true);
    try {
      const response = await fetch("/api/admin/scheduler");
      if (!response.ok) throw new Error("Failed to fetch scheduler status");
      const data = await response.json();
      setSchedulerData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingScheduler(false);
    }
  }, []);

  const fetchKols = useCallback(
    async (
      page = 1,
      search?: string,
      platform?: string,
      isActive?: string
    ) => {
      setIsLoadingKols(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("page_size", "20");
        if (search) params.set("search", search);
        if (platform && platform !== "all") params.set("platform", platform);
        if (isActive && isActive !== "all")
          params.set("is_active", isActive === "active" ? "true" : "false");

        const response = await fetch(`/api/admin/kols?${params.toString()}`);
        if (!response.ok) throw new Error("Failed to fetch KOLs");
        const data = await response.json();
        setAdminKols(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingKols(false);
      }
    },
    []
  );

  const saveKol = useCallback(
    async (data: Record<string, any>, kolId?: number) => {
      setIsSavingKol(true);
      try {
        const isEdit = kolId !== undefined;
        const url = isEdit ? `/api/admin/kols/${kolId}` : "/api/admin/kols";
        const method = isEdit ? "PUT" : "POST";

        const response = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to save KOL");
        }

        setShowKolDialog(false);
        setEditingKol(null);
        fetchKols(kolPage, kolSearch, kolPlatformFilter, kolActiveFilter);
        return true;
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to save KOL");
        return false;
      } finally {
        setIsSavingKol(false);
      }
    },
    [fetchKols, kolPage, kolSearch, kolPlatformFilter, kolActiveFilter]
  );

  const deleteKol = useCallback(
    async (kolId: number, withPosts: boolean) => {
      try {
        const params = withPosts ? "?delete_posts=true" : "";
        const response = await fetch(`/api/admin/kols/${kolId}${params}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to delete KOL");
        }

        setShowDeleteDialog(false);
        setDeletingKolId(null);
        fetchKols(kolPage, kolSearch, kolPlatformFilter, kolActiveFilter);
      } catch (err) {
        alert(err instanceof Error ? err.message : "Failed to delete KOL");
      }
    },
    [fetchKols, kolPage, kolSearch, kolPlatformFilter, kolActiveFilter]
  );

  const toggleKolActive = useCallback(
    async (kolId: number, isActive: boolean) => {
      setTogglingKolIds((prev) => new Set(prev).add(kolId));
      try {
        const response = await fetch(`/api/admin/kols/${kolId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: isActive }),
        });

        if (!response.ok) throw new Error("Failed to toggle KOL status");

        setAdminKols((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            kols: prev.kols.map((k) =>
              k.id === kolId ? { ...k, is_active: isActive } : k
            ),
          };
        });
      } catch (err) {
        console.error(err);
      } finally {
        setTogglingKolIds((prev) => {
          const next = new Set(prev);
          next.delete(kolId);
          return next;
        });
      }
    },
    []
  );

  const fetchRunningTask = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/ai-tasks/current");
      if (!response.ok) return;
      const data = await response.json();
      if (data.has_running && data.task) {
        setRunningAiTask(data.task);
        return true;
      } else {
        setRunningAiTask(null);
        return false;
      }
    } catch (err) {
      console.error(err);
      return false;
    }
  }, []);

  const cancelRunningTask = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/admin/ai-tasks/${taskId}`, {
        method: "POST",
      });
      if (response.ok) {
        setRunningAiTask(null);
        setIsPollingTask(false);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const reviewKolRequest = useCallback(
    async (
      requestId: string,
      status: "approved" | "rejected",
      adminNotes?: string
    ) => {
      setReviewingRequests((prev) => new Set(prev).add(requestId));
      try {
        const response = await fetch(`/api/admin/kol-requests/${requestId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, admin_notes: adminNotes }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to review request");
        }

        // Refresh the list
        await fetchKolRequests(kolRequestsFilter);
      } catch (err) {
        console.error(err);
        throw err;
      } finally {
        setReviewingRequests((prev) => {
          const next = new Set(prev);
          next.delete(requestId);
          return next;
        });
      }
    },
    [fetchKolRequests, kolRequestsFilter]
  );

  const refreshAll = useCallback(() => {
    fetchOverview();
    fetchScrapers();
    fetchTasks();
    fetchUsers(currentPage, searchQuery);
    fetchDatabase();
    fetchKolRequests(kolRequestsFilter);
    fetchAiStats();
    fetchScheduler();
    fetchKols(kolPage, kolSearch, kolPlatformFilter, kolActiveFilter);
  }, [
    fetchOverview,
    fetchScrapers,
    fetchTasks,
    fetchUsers,
    fetchDatabase,
    fetchKolRequests,
    fetchKols,
    kolPage,
    kolSearch,
    kolPlatformFilter,
    kolActiveFilter,
    fetchAiStats,
    fetchScheduler,
    currentPage,
    searchQuery,
    kolRequestsFilter,
  ]);

  // Execute admin action
  const executeAction = useCallback(
    async (action: string, params?: Record<string, any>) => {
      setExecutingActions((prev) => new Set(prev).add(action));
      setActionResults((prev) => {
        const next = { ...prev };
        delete next[action];
        return next;
      });

      try {
        const response = await fetch("/api/admin/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...params }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Action failed");
        }

        // Build result message with details if available
        let message = data.message || "Completed";
        if (data.snapshot_success !== undefined && data.snapshot_failed !== undefined) {
          message = `${message} (✓${data.snapshot_success} ✗${data.snapshot_failed})`;
        } else if (data.details && Array.isArray(data.details) && data.details.length > 0) {
          const successCount = data.details.filter((d: any) => d.success).length;
          const failCount = data.details.filter((d: any) => !d.success).length;
          if (successCount > 0 || failCount > 0) {
            message = `${message} (✓${successCount} ✗${failCount})`;
          }
        }

        setActionResults((prev) => ({
          ...prev,
          [action]: {
            success: data.success !== false,
            message,
          },
        }));

        // Refresh relevant data after action
        if (action.startsWith("scrape")) {
          fetchTasks();
        } else if (action.startsWith("analyze")) {
          fetchOverview();
          // Start polling for AI task progress
          if (action === "analyze-all-posts" && data.task_id) {
            await fetchRunningTask();
          }
        }
      } catch (err) {
        setActionResults((prev) => ({
          ...prev,
          [action]: {
            success: false,
            message: err instanceof Error ? err.message : "Action failed",
          },
        }));
      } finally {
        setExecutingActions((prev) => {
          const next = new Set(prev);
          next.delete(action);
          return next;
        });
      }
    },
    [fetchTasks, fetchOverview, fetchRunningTask]
  );

  const runSchedulerAction = useCallback(
    async (
      jobId: string,
      action: "pause" | "resume" | "reschedule",
      payload?: Record<string, any>
    ) => {
      const key = `${jobId}:${action}`;
      setSchedulerActions((prev) => new Set(prev).add(key));
      setSchedulerResults((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });

      try {
        const response = await fetch("/api/admin/proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: "POST",
            path: `/api/v1/scheduler/jobs/${jobId}/${action}`,
            body: payload || {},
          }),
        });
        const data = await response.json();
        if (!response.ok || !data?.success) {
          throw new Error(data?.error || "Scheduler action failed");
        }
        setSchedulerResults((prev) => ({
          ...prev,
          [jobId]: { ok: true, message: "Updated" },
        }));
        fetchScheduler();
      } catch (err) {
        setSchedulerResults((prev) => ({
          ...prev,
          [jobId]: {
            ok: false,
            message: err instanceof Error ? err.message : "Scheduler action failed",
          },
        }));
      } finally {
        setSchedulerActions((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [fetchScheduler]
  );

  // Initial data fetch
  useEffect(() => {
    if (profile?.is_admin) {
      fetchOverview();
      fetchScrapers();
      fetchTasks();
      fetchUsers(1);
      fetchDatabase();
      fetchKolRequests();
      fetchAiStats();
      fetchRunningTask();
      fetchScheduler();
      fetchKols();
    }
  }, [profile, fetchOverview, fetchScrapers, fetchTasks, fetchUsers, fetchDatabase, fetchKolRequests, fetchAiStats, fetchRunningTask, fetchScheduler, fetchKols]);

  useEffect(() => {
    if (!schedulerData) return;
    setSchedulerEdits((prev) => {
      const next = { ...prev };
      schedulerData.jobs.forEach((job) => {
        if (job.trigger_config?.type === "interval") {
          next[job.id] = {
            intervalHours: typeof job.trigger_config.hours === "number" ? job.trigger_config.hours : prev[job.id]?.intervalHours,
          };
        }
        if (job.trigger_config?.type === "cron") {
          next[job.id] = {
            cronHour: job.trigger_config.hour?.toString() ?? prev[job.id]?.cronHour ?? "",
            cronMinute: job.trigger_config.minute?.toString() ?? prev[job.id]?.cronMinute ?? "",
            timezone: job.trigger_config.timezone ?? prev[job.id]?.timezone ?? "",
          };
        }
      });
      return next;
    });
  }, [schedulerData]);

  // Poll for running AI task progress
  useEffect(() => {
    if (!runningAiTask || runningAiTask.status !== "running") {
      setIsPollingTask(false);
      return;
    }

    setIsPollingTask(true);
    const pollInterval = setInterval(async () => {
      const hasRunning = await fetchRunningTask();
      if (!hasRunning) {
        setIsPollingTask(false);
        // Refresh AI stats when task completes
        fetchAiStats();
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [runningAiTask, fetchRunningTask, fetchAiStats]);

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

  // Search KOLs with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (profile?.is_admin) {
        fetchKols(1, kolSearch, kolPlatformFilter, kolActiveFilter);
        setKolPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [kolSearch, kolPlatformFilter, kolActiveFilter, fetchKols, profile]);

  const isLoading =
    isLoadingOverview ||
    isLoadingScrapers ||
    isLoadingTasks ||
    isLoadingUsers ||
    isLoadingDatabase ||
    isLoadingKolRequests ||
    isLoadingScheduler ||
    isLoadingKols;

  const tabOptions = adminTabs.map((tab) => ({
    value: tab.value,
    label: tab.label,
    icon: <tab.icon className="w-4 h-4" />,
  }));

  // Loading state
  if (profileLoading) {
    return (
      <DashboardLayout title="Admin">
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Not admin
  if (!profile?.is_admin) {
    return (
      <DashboardLayout title="Admin">
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Access Denied
            </h2>
            <p className="text-sm text-muted-foreground">
              You don&apos;t have permission to access this page.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Header actions
  const headerActions = (
    <Button
      variant="ghost"
      size="sm"
      onClick={refreshAll}
      disabled={isLoading}
      className="gap-1.5 h-7"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
    </Button>
  );

  return (
    <DashboardLayout title="Admin" headerActions={headerActions}>
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 md:p-4 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <SwitchTab
              value={activeTab}
              onValueChange={setActiveTab}
              options={tabOptions}
              size="sm"
              variant="pills"
              className="!w-fit"
            />

            {/* Overview Tab */}
            <TabsContent value="overview" className="mt-4 space-y-4">
              {isLoadingOverview ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : overview ? (
                <>
                  <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                    <StatsCard
                      title="Total Users"
                      value={overview.users.total}
                      subtitle={`+${overview.users.new_today} today`}
                      icon={Users}
                    />
                    <StatsCard
                      title="KOL Subscriptions"
                      value={overview.engagement.kol_subscriptions}
                      icon={Activity}
                    />
                    <StatsCard
                      title="Stock Trackings"
                      value={overview.engagement.stock_trackings}
                      icon={TrendingUp}
                    />
                    <StatsCard
                      title="News Articles"
                      value={overview.news.total_articles}
                      icon={Newspaper}
                    />
                  </div>

                  <SectionCard title="Platform Data" titleSize="sm">
                    <div className="grid gap-3 md:grid-cols-2 px-3 pb-3">
                      <div className="flex items-center justify-between p-2.5 bg-muted rounded-lg">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Twitter KOLs
                          </p>
                          <p className="text-base font-semibold text-foreground">
                            {overview.twitter.total_kols}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {overview.twitter.total_tweets.toLocaleString()} tweets
                        </p>
                      </div>
                      <div className="flex items-center justify-between p-2.5 bg-muted rounded-lg">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Xiaohongshu Posts
                          </p>
                          <p className="text-base font-semibold text-foreground">
                            {overview.xiaohongshu.total_posts}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {overview.xiaohongshu.stock_related_posts} stock related
                        </p>
                      </div>
                    </div>
                  </SectionCard>
                </>
              ) : null}
            </TabsContent>

            {/* KOLs Management Tab */}
            <TabsContent value="kols" className="mt-4 space-y-4">
              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Search username or display name..."
                    value={kolSearch}
                    onChange={(e) => setKolSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <Select
                  value={kolPlatformFilter}
                  onValueChange={setKolPlatformFilter}
                >
                  <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
                    <SelectValue placeholder="Platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Platforms</SelectItem>
                    <SelectItem value="twitter">Twitter</SelectItem>
                    <SelectItem value="xiaohongshu">Xiaohongshu</SelectItem>
                    <SelectItem value="reddit">Reddit</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={kolActiveFilter}
                  onValueChange={setKolActiveFilter}
                >
                  <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => {
                    setEditingKol(null);
                    setKolFormData({
                      platform: "twitter",
                      username: "",
                      display_name: "",
                      bio: "",
                      avatar_url: "",
                      profile_url: "",
                      is_active: true,
                    });
                    setShowKolDialog(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-xs">Add KOL</span>
                </Button>
              </div>

              {/* Stats Bar */}
              {adminKols && (
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    Total: <strong className="text-foreground">{adminKols.total}</strong>
                  </span>
                  <span>
                    Page {adminKols.page} of{" "}
                    {Math.ceil(adminKols.total / adminKols.page_size)}
                  </span>
                </div>
              )}

              {/* KOL Table */}
              {isLoadingKols ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : adminKols && adminKols.kols.length > 0 ? (
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-[200px]">KOL</TableHead>
                        <TableHead className="text-xs">Platform</TableHead>
                        <TableHead className="text-xs text-right">Followers</TableHead>
                        <TableHead className="text-xs text-right">Posts</TableHead>
                        <TableHead className="text-xs text-right">Subs</TableHead>
                        <TableHead className="text-xs text-center">Active</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminKols.kols.map((kol) => (
                        <TableRow key={kol.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                src={kol.avatar_url}
                                fallback={
                                  kol.username?.charAt(0).toUpperCase() || "?"
                                }
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {kol.display_name || kol.username}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  @{kol.username}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0",
                                kol.platform === "twitter" &&
                                  "border-blue-300 text-blue-600 dark:border-blue-600 dark:text-blue-400",
                                kol.platform === "xiaohongshu" &&
                                  "border-red-300 text-red-600 dark:border-red-600 dark:text-red-400",
                                kol.platform === "reddit" &&
                                  "border-orange-300 text-orange-600 dark:border-orange-600 dark:text-orange-400",
                                kol.platform === "youtube" &&
                                  "border-red-300 text-red-600 dark:border-red-600 dark:text-red-400"
                              )}
                            >
                              {kol.platform}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {(kol.followers_count || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {(kol.posts_count || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {(kol.subscribers_count || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={kol.is_active}
                              onCheckedChange={(checked) =>
                                toggleKolActive(kol.id, checked)
                              }
                              disabled={togglingKolIds.has(kol.id)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingKol(kol);
                                  setKolFormData({
                                    platform: kol.platform,
                                    username: kol.username,
                                    display_name: kol.display_name || "",
                                    bio: kol.bio || "",
                                    avatar_url: kol.avatar_url || "",
                                    profile_url: kol.profile_url || "",
                                    platform_user_id:
                                      kol.platform_user_id || "",
                                    is_verified: kol.is_verified,
                                    followers_count: kol.followers_count || 0,
                                    following_count: kol.following_count || 0,
                                    location: kol.location || "",
                                    website: kol.website || "",
                                    is_active: kol.is_active,
                                  });
                                  setShowKolDialog(true);
                                }}
                                title="Edit"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                                onClick={() => {
                                  setDeletingKolId(kol.id);
                                  setDeleteWithPosts(false);
                                  setShowDeleteDialog(true);
                                }}
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {adminKols.total > adminKols.page_size && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                      <p className="text-xs text-muted-foreground">
                        Showing{" "}
                        {(adminKols.page - 1) * adminKols.page_size + 1}-
                        {Math.min(
                          adminKols.page * adminKols.page_size,
                          adminKols.total
                        )}{" "}
                        of {adminKols.total}
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={kolPage <= 1}
                          onClick={() => {
                            const newPage = kolPage - 1;
                            setKolPage(newPage);
                            fetchKols(
                              newPage,
                              kolSearch,
                              kolPlatformFilter,
                              kolActiveFilter
                            );
                          }}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs px-2">
                          {kolPage} / {Math.ceil(adminKols.total / adminKols.page_size)}
                        </span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          disabled={
                            kolPage >=
                            Math.ceil(adminKols.total / adminKols.page_size)
                          }
                          onClick={() => {
                            const newPage = kolPage + 1;
                            setKolPage(newPage);
                            fetchKols(
                              newPage,
                              kolSearch,
                              kolPlatformFilter,
                              kolActiveFilter
                            );
                          }}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No KOLs found
                </div>
              )}

              {/* Create/Edit KOL Dialog */}
              <Dialog open={showKolDialog} onOpenChange={setShowKolDialog}>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-base">
                      {editingKol ? "Edit KOL" : "Add New KOL"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Platform *
                        </label>
                        <Select
                          value={kolFormData.platform}
                          onValueChange={(v) =>
                            setKolFormData((p) => ({ ...p, platform: v }))
                          }
                          disabled={!!editingKol}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="twitter">Twitter</SelectItem>
                            <SelectItem value="xiaohongshu">Xiaohongshu</SelectItem>
                            <SelectItem value="reddit">Reddit</SelectItem>
                            <SelectItem value="youtube">YouTube</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Username *
                        </label>
                        <Input
                          value={kolFormData.username}
                          onChange={(e) =>
                            setKolFormData((p) => ({
                              ...p,
                              username: e.target.value,
                            }))
                          }
                          placeholder="e.g. elonmusk"
                          className="h-8 text-xs"
                          disabled={!!editingKol}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Display Name
                      </label>
                      <Input
                        value={kolFormData.display_name}
                        onChange={(e) =>
                          setKolFormData((p) => ({
                            ...p,
                            display_name: e.target.value,
                          }))
                        }
                        placeholder="Display name"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Bio
                      </label>
                      <Input
                        value={kolFormData.bio}
                        onChange={(e) =>
                          setKolFormData((p) => ({ ...p, bio: e.target.value }))
                        }
                        placeholder="KOL bio"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Avatar URL
                        </label>
                        <Input
                          value={kolFormData.avatar_url}
                          onChange={(e) =>
                            setKolFormData((p) => ({
                              ...p,
                              avatar_url: e.target.value,
                            }))
                          }
                          placeholder="https://..."
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Profile URL
                        </label>
                        <Input
                          value={kolFormData.profile_url}
                          onChange={(e) =>
                            setKolFormData((p) => ({
                              ...p,
                              profile_url: e.target.value,
                            }))
                          }
                          placeholder="https://..."
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Platform User ID
                        </label>
                        <Input
                          value={kolFormData.platform_user_id || ""}
                          onChange={(e) =>
                            setKolFormData((p) => ({
                              ...p,
                              platform_user_id: e.target.value,
                            }))
                          }
                          placeholder="Platform specific ID"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Location
                        </label>
                        <Input
                          value={kolFormData.location || ""}
                          onChange={(e) =>
                            setKolFormData((p) => ({
                              ...p,
                              location: e.target.value,
                            }))
                          }
                          placeholder="Location"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Followers
                        </label>
                        <Input
                          type="number"
                          value={kolFormData.followers_count || 0}
                          onChange={(e) =>
                            setKolFormData((p) => ({
                              ...p,
                              followers_count: parseInt(e.target.value) || 0,
                            }))
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Following
                        </label>
                        <Input
                          type="number"
                          value={kolFormData.following_count || 0}
                          onChange={(e) =>
                            setKolFormData((p) => ({
                              ...p,
                              following_count: parseInt(e.target.value) || 0,
                            }))
                          }
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Website
                      </label>
                      <Input
                        value={kolFormData.website || ""}
                        onChange={(e) =>
                          setKolFormData((p) => ({
                            ...p,
                            website: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={kolFormData.is_active !== false}
                          onCheckedChange={(checked) =>
                            setKolFormData((p) => ({
                              ...p,
                              is_active: checked,
                            }))
                          }
                        />
                        <label className="text-xs text-muted-foreground">
                          Active
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={kolFormData.is_verified === true}
                          onCheckedChange={(checked) =>
                            setKolFormData((p) => ({
                              ...p,
                              is_verified: checked,
                            }))
                          }
                        />
                        <label className="text-xs text-muted-foreground">
                          Verified
                        </label>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowKolDialog(false)}
                      className="h-8 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      disabled={
                        isSavingKol ||
                        !kolFormData.username?.trim() ||
                        !kolFormData.platform
                      }
                      onClick={() => saveKol(kolFormData, editingKol?.id)}
                    >
                      {isSavingKol && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {editingKol ? "Save Changes" : "Create KOL"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Delete Confirmation Dialog */}
              <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="text-base text-red-600 dark:text-red-400">
                      Delete KOL
                    </DialogTitle>
                  </DialogHeader>
                  <div className="py-2 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Are you sure you want to delete this KOL? This action
                      cannot be undone.
                    </p>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={deleteWithPosts}
                        onCheckedChange={setDeleteWithPosts}
                      />
                      <label className="text-xs text-muted-foreground">
                        Also delete all posts from this KOL
                      </label>
                    </div>
                    {deleteWithPosts && (
                      <p className="text-[11px] text-red-500 dark:text-red-400">
                        Warning: This will permanently delete all posts
                        associated with this KOL.
                      </p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteDialog(false)}
                      className="h-8 text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        if (deletingKolId !== null) {
                          deleteKol(deletingKolId, deleteWithPosts);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* Scheduler Tab */}
            <TabsContent value="scheduler" className="mt-4 space-y-4">
              {isLoadingScheduler ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Scheduler Status Header */}
                  <div className="bg-card border border-border rounded-lg p-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center",
                          schedulerData?.is_running
                            ? "bg-green-100 dark:bg-green-500/20"
                            : "bg-red-100 dark:bg-red-500/20"
                        )}>
                          {schedulerData?.is_running ? (
                            <Power className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                          ) : (
                            <PowerOff className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-xs font-semibold text-foreground">
                            Task Scheduler
                          </h3>
                          <p className="text-[11px] text-muted-foreground">
                            {schedulerData?.is_running ? (
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                Running - {schedulerData.jobs_count} jobs registered
                              </span>
                            ) : (
                              "Scheduler is not running"
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchScheduler}
                        disabled={isLoadingScheduler}
                        className="h-6 gap-1.5 px-2"
                      >
                        <RefreshCw className={cn("h-3 w-3", isLoadingScheduler && "animate-spin")} />
                        <span className="text-[11px]">Refresh</span>
                      </Button>
                    </div>
                  </div>

                  {/* Scheduled Jobs by Category */}
                  {["news", "scraper", "sync"].map((category) => {
                    const categoryJobs = scheduledJobsConfig.filter((j) => j.category === category);
                    const categoryLabels: Record<string, { label: string; icon: React.ElementType }> = {
                      news: { label: "News Collection", icon: Newspaper },
                      scraper: { label: "Data Scraping", icon: Bot },
                      sync: { label: "Data Synchronization", icon: RotateCw },
                    };
                    const { label, icon: CategoryIcon } = categoryLabels[category];

                    return (
                      <div key={category}>
                        <h3 className="text-[10px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                          <CategoryIcon className="h-3 w-3" />
                          {label}
                        </h3>
                        <div className="grid gap-2.5 md:grid-cols-2">
                          {categoryJobs.map((jobConfig) => {
                            const liveJob = schedulerData?.jobs.find((j) => j.id === jobConfig.id);
                            const Icon = jobConfig.icon;
                            const nextRun = liveJob?.next_run_time
                              ? new Date(liveJob.next_run_time)
                              : null;
                            const isJobActive = !!liveJob;

                            return (
                              <div
                                key={jobConfig.id}
                                className="bg-card border border-border rounded-lg p-2.5"
                              >
                                <div className="flex items-start gap-3">
                                  <div className={cn(
                                    "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                                    isJobActive
                                      ? "bg-blue-100 dark:bg-blue-500/20"
                                      : "bg-muted"
                                  )}>
                                    <Icon className={cn(
                                      "h-3.5 w-3.5",
                                      isJobActive
                                        ? "text-blue-600 dark:text-blue-400"
                                        : "text-gray-400"
                                    )} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-xs font-medium text-foreground">
                                        {jobConfig.name}
                                      </h4>
                                      {isJobActive ? (
                                        <Badge variant="outline" className="text-[10px] bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800">
                                          Active
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-[10px] text-gray-400">
                                          Inactive
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      {jobConfig.description}
                                    </p>
                                    <div className="flex items-center gap-3 mt-2">
                                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                        <Timer className="h-3 w-3" />
                                        <span>{jobConfig.frequency}</span>
                                      </div>
                                      {nextRun && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                          <Clock className="h-3 w-3" />
                                          <span>
                                            Next: {nextRun.toLocaleString()}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  {jobConfig.actionEndpoint && (
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      onClick={() => executeAction(jobConfig.actionEndpoint!)}
                                      disabled={executingActions.has(jobConfig.actionEndpoint)}
                                      className="h-6 gap-1 px-2"
                                    >
                                      {executingActions.has(jobConfig.actionEndpoint) ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Play className="h-3 w-3" />
                                      )}
                                      <span className="text-[10px]">Run Now</span>
                                    </Button>
                                  )}
                                </div>

                                {/* Trigger details */}
                                {liveJob && (
                                  <div className="mt-2 pt-2 border-t border-border space-y-2">
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="text-muted-foreground">
                                        Trigger: {liveJob.trigger_type}
                                      </span>
                                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                                        {liveJob.trigger_details}
                                      </code>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        onClick={() =>
                                          runSchedulerAction(
                                            jobConfig.id,
                                            liveJob.is_paused || !liveJob.next_run_time ? "resume" : "pause"
                                          )
                                        }
                                        disabled={schedulerActions.has(`${jobConfig.id}:${liveJob.is_paused || !liveJob.next_run_time ? "resume" : "pause"}`)}
                                        className="h-6 px-2 text-[10px]"
                                      >
                                        {liveJob.is_paused || !liveJob.next_run_time ? "Resume" : "Pause"}
                                      </Button>

                                      {liveJob.trigger_config?.type === "interval" && (
                                        <>
                                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                            <span>Every</span>
                                            <Input
                                              type="number"
                                              min={1}
                                              max={168}
                                              value={schedulerEdits[jobConfig.id]?.intervalHours ?? ""}
                                              onChange={(e) =>
                                                setSchedulerEdits((prev) => ({
                                                  ...prev,
                                                  [jobConfig.id]: {
                                                    ...prev[jobConfig.id],
                                                    intervalHours: parseInt(e.target.value || "0", 10),
                                                  },
                                                }))
                                              }
                                              className="h-5 w-12 text-[10px] px-1"
                                            />
                                            <span>hours</span>
                                          </div>
                                          <Button
                                            size="xs"
                                            variant="outline"
                                            onClick={() =>
                                              runSchedulerAction(jobConfig.id, "reschedule", {
                                                trigger_type: "interval",
                                                hours: schedulerEdits[jobConfig.id]?.intervalHours,
                                              })
                                            }
                                            disabled={
                                              !schedulerEdits[jobConfig.id]?.intervalHours ||
                                              schedulerActions.has(`${jobConfig.id}:reschedule`)
                                            }
                                            className="h-6 px-2 text-[10px]"
                                          >
                                            Update
                                          </Button>
                                        </>
                                      )}

                                      {liveJob.trigger_config?.type === "cron" && (
                                        <>
                                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                            <span>At</span>
                                            <Input
                                              type="number"
                                              min={0}
                                              max={23}
                                              value={schedulerEdits[jobConfig.id]?.cronHour ?? ""}
                                              onChange={(e) =>
                                                setSchedulerEdits((prev) => ({
                                                  ...prev,
                                                  [jobConfig.id]: {
                                                    ...prev[jobConfig.id],
                                                    cronHour: e.target.value,
                                                  },
                                                }))
                                              }
                                              className="h-5 w-10 text-[10px] px-1"
                                            />
                                            <span>:</span>
                                            <Input
                                              type="number"
                                              min={0}
                                              max={59}
                                              value={schedulerEdits[jobConfig.id]?.cronMinute ?? ""}
                                              onChange={(e) =>
                                                setSchedulerEdits((prev) => ({
                                                  ...prev,
                                                  [jobConfig.id]: {
                                                    ...prev[jobConfig.id],
                                                    cronMinute: e.target.value,
                                                  },
                                                }))
                                              }
                                              className="h-5 w-10 text-[10px] px-1"
                                            />
                                          </div>
                                          <Input
                                            type="text"
                                            value={schedulerEdits[jobConfig.id]?.timezone ?? ""}
                                            onChange={(e) =>
                                              setSchedulerEdits((prev) => ({
                                                ...prev,
                                                [jobConfig.id]: {
                                                  ...prev[jobConfig.id],
                                                  timezone: e.target.value,
                                                },
                                              }))
                                            }
                                            placeholder="Timezone"
                                            className="h-5 w-28 text-[10px] px-2"
                                          />
                                          <Button
                                            size="xs"
                                            variant="outline"
                                            onClick={() =>
                                              runSchedulerAction(jobConfig.id, "reschedule", {
                                                trigger_type: "cron",
                                                hour: schedulerEdits[jobConfig.id]?.cronHour,
                                                minute: schedulerEdits[jobConfig.id]?.cronMinute,
                                                timezone: schedulerEdits[jobConfig.id]?.timezone,
                                              })
                                            }
                                            disabled={
                                              schedulerActions.has(`${jobConfig.id}:reschedule`) ||
                                              schedulerEdits[jobConfig.id]?.cronHour === "" ||
                                              schedulerEdits[jobConfig.id]?.cronMinute === ""
                                            }
                                            className="h-6 px-2 text-[10px]"
                                          >
                                            Update
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Action result */}
                                {jobConfig.actionEndpoint && actionResults[jobConfig.actionEndpoint] && (
                                  <div className="mt-2">
                                    <div
                                      className={cn(
                                        "text-[10px] px-2 py-1 rounded inline-flex items-center gap-1",
                                        actionResults[jobConfig.actionEndpoint].success
                                          ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                                          : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                                      )}
                                    >
                                      {actionResults[jobConfig.actionEndpoint].success ? (
                                        <CheckCircle2 className="h-3 w-3" />
                                      ) : (
                                        <XCircle className="h-3 w-3" />
                                      )}
                                      <span className="truncate">
                                        {actionResults[jobConfig.actionEndpoint].message}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {liveJob && schedulerResults[jobConfig.id] && (
                                  <div className="mt-2">
                                    <div
                                      className={cn(
                                        "text-[10px] px-2 py-1 rounded inline-flex items-center gap-1",
                                        schedulerResults[jobConfig.id].ok
                                          ? "bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                                          : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
                                      )}
                                    >
                                      <span>{schedulerResults[jobConfig.id].message}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* All Jobs Table */}
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="px-3 py-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <Settings2 className="h-3.5 w-3.5 text-gray-500" />
                        <span className="text-xs font-medium text-foreground">
                          All Registered Jobs
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          ({schedulerData?.jobs_count || 0})
                        </span>
                      </div>
                    </div>
                    {schedulerData && schedulerData.jobs.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[11px]">Job ID</TableHead>
                            <TableHead className="text-[11px]">Name</TableHead>
                            <TableHead className="text-[11px]">Trigger</TableHead>
                            <TableHead className="text-[11px]">Next Run</TableHead>
                            <TableHead className="text-[11px]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {schedulerData.jobs.map((job) => (
                            <TableRow key={job.id}>
                              <TableCell className="font-mono text-[10px] text-muted-foreground">
                                {job.id}
                              </TableCell>
                              <TableCell className="text-xs font-medium text-foreground">
                                {job.name}
                              </TableCell>
                              <TableCell>
                                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                                  {job.trigger_details}
                                </code>
                              </TableCell>
                              <TableCell className="text-[11px] text-muted-foreground">
                                {job.next_run_time
                                  ? new Date(job.next_run_time).toLocaleString()
                                  : "—"
                                }
                              </TableCell>
                              <TableCell>
                                {job.next_run_time ? (
                                  <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span className="text-[11px]">Scheduled</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-gray-400">
                                    <Pause className="h-3 w-3" />
                                    <span className="text-[11px]">Paused</span>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No scheduled jobs found
                      </div>
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            {/* Actions Tab */}
            <TabsContent value="actions" className="mt-4 space-y-4">
              {/* Scraper Actions */}
              <div>
                <h3 className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                  <Bot className="h-3.5 w-3.5" />
                  Data Collection
                </h3>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {adminActions
                    .filter((a) => a.category === "scraper")
                    .map((action) => (
                      <ActionCard
                        key={action.id}
                        config={action}
                        onExecute={executeAction}
                        isExecuting={executingActions.has(action.action)}
                        result={actionResults[action.action]}
                      />
                    ))}
                </div>
              </div>

              {/* AI Analysis Stats */}
              {aiStats && (
                <div className="bg-card border border-border rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-medium text-foreground flex items-center gap-2">
                      <Brain className="h-3.5 w-3.5 text-primary" />
                      AI Analysis Status
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchAiStats}
                      disabled={isLoadingAiStats}
                      className="h-6 px-2"
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", isLoadingAiStats && "animate-spin")} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center p-2.5 bg-muted rounded-lg">
                      <p className="text-xl font-bold text-foreground">
                        {aiStats.total_posts.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Total Posts</p>
                    </div>
                    <div className="text-center p-2.5 bg-green-50 dark:bg-green-500/10 rounded-lg">
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">
                        {aiStats.analyzed_posts.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Analyzed</p>
                    </div>
                    <div className="text-center p-2.5 bg-yellow-50 dark:bg-yellow-500/10 rounded-lg">
                      <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                        {aiStats.unanalyzed_posts.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Unanalyzed</p>
                    </div>
                    <div className="text-center p-2.5 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {aiStats.analysis_rate}%
                      </p>
                      <p className="text-[11px] text-muted-foreground">Coverage</p>
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2.5 border-t border-border">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Sentiment Distribution:</span>
                      <div className="flex items-center gap-3">
                        <span className="text-green-600 dark:text-green-400">
                          🐂 Bullish: {aiStats.sentiment_distribution.bullish}
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                          🐻 Bearish: {aiStats.sentiment_distribution.bearish}
                        </span>
                        <span className="text-muted-foreground">
                          ⚪ Neutral: {aiStats.sentiment_distribution.neutral}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Stock related posts: {aiStats.stock_related_posts.toLocaleString()}
                    </div>
                  </div>
                </div>
              )}

              {/* Running AI Task Progress */}
              {runningAiTask && runningAiTask.status === "running" && (
                <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      AI Analysis Running
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelRunningTask(runningAiTask.task_id)}
                      className="h-6 px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      <span className="text-xs">Cancel</span>
                    </Button>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-2.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{runningAiTask.progress_percent}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300 ease-out"
                        style={{ width: `${runningAiTask.progress_percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-2.5 text-center">
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-base font-bold text-foreground">
                        {runningAiTask.analyzed_count}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Analyzed</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-base font-bold text-red-600 dark:text-red-400">
                        {runningAiTask.failed_count}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Failed</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-base font-bold text-muted-foreground">
                        {runningAiTask.skipped_count}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Skipped</p>
                    </div>
                    <div className="p-2 bg-muted/50 rounded">
                      <p className="text-base font-bold text-foreground">
                        {runningAiTask.total_posts}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Total</p>
                    </div>
                  </div>

                  {/* Task Details */}
                  <div className="mt-2.5 pt-2.5 border-t border-blue-200 dark:border-blue-800/50 text-[11px] text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Platform: {runningAiTask.platform}</span>
                      <span>Batch: {runningAiTask.current_batch} (size: {runningAiTask.batch_size})</span>
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="font-mono text-[11px] opacity-60">{runningAiTask.task_id}</span>
                      {isPollingTask && (
                        <span className="text-gery-500 animate-pulse">● Polling</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Analysis Actions */}
              <div>
                <h3 className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                  <Brain className="h-3.5 w-3.5" />
                  AI Analysis
                </h3>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {adminActions
                    .filter((a) => a.category === "analysis")
                    .map((action) => (
                      <ActionCard
                        key={action.id}
                        config={action}
                        onExecute={executeAction}
                        isExecuting={executingActions.has(action.action)}
                        result={actionResults[action.action]}
                      />
                    ))}
                </div>
              </div>

              {/* Sync Actions */}
              <div>
                <h3 className="text-[11px] font-medium text-muted-foreground mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Data Sync
                </h3>
                <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {adminActions
                    .filter((a) => a.category === "sync")
                    .map((action) => (
                      <ActionCard
                        key={action.id}
                        config={action}
                        onExecute={executeAction}
                        isExecuting={executingActions.has(action.action)}
                        result={actionResults[action.action]}
                      />
                    ))}
                </div>
              </div>
            </TabsContent>

            {/* KOL Requests Tab */}
            <TabsContent value="kol-requests" className="mt-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <Select
                  value={kolRequestsFilter}
                  onValueChange={(value) => {
                    setKolRequestsFilter(value);
                    fetchKolRequests(value);
                  }}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Requests</SelectItem>
                    <SelectItem value="pending" className="text-xs">Pending</SelectItem>
                    <SelectItem value="approved" className="text-xs">Approved</SelectItem>
                    <SelectItem value="rejected" className="text-xs">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchKolRequests(kolRequestsFilter)}
                  disabled={isLoadingKolRequests}
                  className="h-8 gap-1.5"
                >
                  <RefreshCw
                    className={cn(
                      "h-3.5 w-3.5",
                      isLoadingKolRequests && "animate-spin"
                    )}
                  />
                  <span className="text-xs">Refresh</span>
                </Button>
                {kolRequests && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {kolRequests.total} request{kolRequests.total !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {isLoadingKolRequests ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : kolRequests && kolRequests.requests.length > 0 ? (
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">KOL</TableHead>
                        <TableHead className="text-xs">Requested By</TableHead>
                        <TableHead className="text-xs">Notes</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kolRequests.requests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                <AtSign className="h-3.5 w-3.5 text-gray-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  @{request.platform_user_id}
                                </p>
                                <p className="text-[11px] text-muted-foreground capitalize">
                                  {request.platform}
                                </p>
                              </div>
                              <a
                                href={`https://x.com/${request.platform_user_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                src={request.user_avatar_url}
                                fallback={
                                  (request.user_username || request.user_email)?.[0]?.toUpperCase() || "?"
                                }
                              />
                              <div>
                                <p className="text-xs text-foreground">
                                  {request.user_username || "Unknown"}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {request.user_email}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-xs text-muted-foreground max-w-[200px] truncate">
                              {request.user_notes || "—"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                request.status === "approved"
                                  ? "default"
                                  : request.status === "rejected"
                                    ? "destructive"
                                    : "outline"
                              }
                              className={cn(
                                "capitalize text-[11px]",
                                request.status === "pending" &&
                                "bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
                              )}
                            >
                              {request.status === "pending" && (
                                <Clock className="h-3 w-3 mr-1" />
                              )}
                              {request.status === "approved" && (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              )}
                              {request.status === "rejected" && (
                                <XCircle className="h-3 w-3 mr-1" />
                              )}
                              {request.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(request.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {request.status === "pending" ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    reviewKolRequest(request.id, "approved")
                                  }
                                  disabled={reviewingRequests.has(request.id)}
                                  className="h-6 px-2 gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-500/10"
                                >
                                  {reviewingRequests.has(request.id) ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="h-3 w-3" />
                                  )}
                                  <span className="text-[11px]">Approve</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    reviewKolRequest(request.id, "rejected")
                                  }
                                  disabled={reviewingRequests.has(request.id)}
                                  className="h-6 px-2 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
                                >
                                  {reviewingRequests.has(request.id) ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <XCircle className="h-3 w-3" />
                                  )}
                                  <span className="text-[11px]">Reject</span>
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-400">
                                {request.reviewed_at &&
                                  new Date(request.reviewed_at).toLocaleDateString()}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-12">
                  <UserPlus className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    No KOL tracking requests found
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Scrapers Tab */}
            <TabsContent value="scrapers" className="mt-4 space-y-4">
              {isLoadingScrapers ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : scrapers ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <ScraperStatusCard
                    name="Twitter Scraper"
                    status={scrapers.twitter.status as any}
                    stats={[
                      {
                        label: "Active KOLs",
                        value: scrapers.twitter.active_kol_count,
                      },
                    ]}
                    details={[
                      {
                        label: "Cookies",
                        value: scrapers.twitter.cookies_available,
                      },
                      {
                        label: "Database",
                        value: scrapers.twitter.supabase_connected,
                      },
                    ]}
                  />
                  <ScraperStatusCard
                    name="Xiaohongshu Scraper"
                    status={scrapers.xiaohongshu.status as any}
                    stats={[
                      {
                        label: "Total Posts",
                        value: scrapers.xiaohongshu.total_posts,
                      },
                      {
                        label: "Stock Related",
                        value: scrapers.xiaohongshu.stock_related_posts,
                      },
                    ]}
                    details={[
                      {
                        label: "Logged In",
                        value: scrapers.xiaohongshu.is_logged_in,
                      },
                      {
                        label: "Database",
                        value: scrapers.xiaohongshu.supabase_connected,
                      },
                    ]}
                  />
                </div>
              ) : null}

              {/* Recent Tasks */}
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-3 py-2.5 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-foreground">
                        Recent Tasks
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={fetchTasks}
                      disabled={isLoadingTasks}
                      className="h-6 px-2"
                    >
                      <RefreshCw
                        className={cn(
                          "h-3.5 w-3.5",
                          isLoadingTasks && "animate-spin"
                        )}
                      />
                    </Button>
                  </div>
                </div>
                {isLoadingTasks ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : tasks && tasks.tasks.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Task</TableHead>
                        <TableHead className="text-xs">Platform</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Duration</TableHead>
                        <TableHead className="text-xs">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.tasks.map((task) => (
                        <TableRow key={task.task_id}>
                          <TableCell className="font-mono text-[11px]">
                            {task.task_id}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-[11px]">
                              {task.platform}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {task.status === "completed" && (
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                              )}
                              {task.status === "running" && (
                                <Play className="h-3 w-3 text-blue-600" />
                              )}
                              {task.status === "failed" && (
                                <XCircle className="h-3 w-3 text-red-600" />
                              )}
                              {task.status === "pending" && (
                                <Clock className="h-3 w-3 text-gray-400" />
                              )}
                              <span
                                className={cn(
                                  "text-xs capitalize",
                                  task.status === "completed" &&
                                  "text-green-600",
                                  task.status === "running" && "text-blue-600",
                                  task.status === "failed" && "text-red-600",
                                  task.status === "pending" && "text-gray-500"
                                )}
                              >
                                {task.status}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {task.duration_human || "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(task.created_at).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent tasks
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="mt-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by email or username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-8 text-xs"
                  />
                </div>
                {users && (
                  <span className="text-xs text-muted-foreground">
                    {users.total} users
                  </span>
                )}
              </div>

              {isLoadingUsers ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : users && users.users.length > 0 ? (
                <>
                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">User</TableHead>
                          <TableHead className="text-xs">Email</TableHead>
                          <TableHead className="text-xs">Membership</TableHead>
                          <TableHead className="text-xs">Role</TableHead>
                          <TableHead className="text-xs">Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <UserAvatar
                                  src={user.avatar_url}
                                  fallback={(user.username || user.email)?.[0]?.toUpperCase() || "?"}
                                />
                                <span className="text-sm font-medium text-foreground">
                                  {user.username || user.full_name || "—"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {user.email}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-normal text-[11px]">
                                {user.membership}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.is_admin ? (
                                <Badge variant="secondary" className="gap-1 text-[11px]">
                                  <Shield className="h-3 w-3" />
                                  <span>Admin</span>
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  User
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(user.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {users.total > users.page_size && (
                    <div className="flex items-center justify-center gap-2 pt-2">
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
                        <span className="text-xs">Previous</span>
                      </Button>
                      <span className="text-xs text-muted-foreground px-2">
                        {currentPage} / {Math.ceil(users.total / users.page_size)}
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
                          currentPage >= Math.ceil(users.total / users.page_size)
                        }
                      >
                        <span className="text-xs">Next</span>
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-muted-foreground">No users found</p>
                </div>
              )}
            </TabsContent>

            {/* Database Tab */}
            <TabsContent value="database" className="mt-4">
              {isLoadingDatabase ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : database ? (
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-border">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-foreground">
                        Database Tables
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({Object.keys(database.tables).length})
                      </span>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Table</TableHead>
                        <TableHead className="text-xs text-right">Rows</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(database.tables)
                        .sort((a, b) => {
                          const aVal = typeof a[1] === "number" ? a[1] : -1;
                          const bVal = typeof b[1] === "number" ? b[1] : -1;
                          return bVal - aVal;
                        })
                        .map(([table, count]) => (
                          <TableRow key={table}>
                            <TableCell className="font-mono text-xs">
                              {table}
                            </TableCell>
                            <TableCell className="text-right text-sm font-medium">
                              {typeof count === "number"
                                ? count.toLocaleString()
                                : count}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
