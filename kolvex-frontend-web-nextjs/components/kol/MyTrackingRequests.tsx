"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TrackingRequest {
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
}

interface MyTrackingRequestsProps {
  refreshTrigger?: number;
}

export function MyTrackingRequests({
  refreshTrigger,
}: MyTrackingRequestsProps) {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<TrackingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/kol-tracking-requests");
      const data = await response.json();

      if (response.ok) {
        setRequests(data.requests || []);
      } else {
        console.error("Failed to fetch requests:", data.error);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests, refreshTrigger]);

  const handleCancel = async (requestId: string) => {
    setDeletingId(requestId);
    try {
      const response = await fetch(
        `/api/kol-tracking-requests/${requestId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        toast.success(t("kol.myRequests.cancelSuccess"));
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
      } else {
        const data = await response.json();
        throw new Error(data.error || t("kol.myRequests.cancelFailed"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("kol.myRequests.cancelFailed")
      );
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case "approved":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "rejected":
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400";
      case "approved":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
      case "rejected":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (requests.length === 0) {
    return null; // Don't show anything if no requests
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="border border-border-light dark:border-border-dark rounded-lg overflow-hidden">
      {/* Header - Collapsible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t("kol.myRequests.title")}
          </span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
              {t("kol.myRequests.pending", { count: String(pendingCount) })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              fetchRequests();
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="divide-y divide-border-light dark:divide-border-dark">
          {requests.map((request) => (
            <div
              key={request.id}
              className="px-4 py-3 flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                    @{request.platform_user_id}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full",
                      getStatusBadgeClass(request.status)
                    )}
                  >
                    {getStatusIcon(request.status)}
                    {request.status.charAt(0).toUpperCase() +
                      request.status.slice(1)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t("kol.myRequests.submitted", { date: formatDate(request.created_at) })}
                  {request.reviewed_at &&
                    ` · ${t("kol.myRequests.reviewed", { date: formatDate(request.reviewed_at) })}`}
                </p>
                {request.admin_notes && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                    {t("kol.myRequests.admin")} {request.admin_notes}
                  </p>
                )}
              </div>

              {request.status === "pending" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancel(request.id)}
                  disabled={deletingId === request.id}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  {deletingId === request.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
