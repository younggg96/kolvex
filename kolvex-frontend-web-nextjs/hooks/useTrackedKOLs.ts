import { useState, useEffect, useCallback } from "react";
import {
  fetchTrackedKOLs,
  trackKOL,
  updateTrackedKOL,
  untrackKOL,
  toggleTrackKOL,
  type TrackedKOL,
  type CreateTrackedKOLInput,
  type UpdateTrackedKOLInput,
} from "@/lib/trackedKolApi";
import type { Platform } from "@/lib/mockData";
import { toast } from "sonner";

export function useTrackedKOLs(platform?: Platform, notify?: boolean) {
  const [trackedKOLs, setTrackedKOLs] = useState<TrackedKOL[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载追踪的 KOL 列表
  const loadTrackedKOLs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchTrackedKOLs(platform, notify);
      setTrackedKOLs(response.tracked_kols);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load tracked KOLs";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [platform, notify]);

  // 初始加载
  useEffect(() => {
    loadTrackedKOLs();
  }, [loadTrackedKOLs]);

  // 添加追踪
  const addTrack = useCallback(async (data: CreateTrackedKOLInput) => {
    try {
      const newKOL = await trackKOL(data);
      setTrackedKOLs((prev) => [newKOL, ...prev]);
      toast.success(`Successfully tracking ${data.kol_id}`);
      return newKOL;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to track KOL";
      toast.error(message);
      throw err;
    }
  }, []);

  // 更新追踪
  const updateTrack = useCallback(
    async (kol_id: string, platform: Platform, data: UpdateTrackedKOLInput) => {
      try {
        const updated = await updateTrackedKOL(kol_id, platform, data);
        setTrackedKOLs((prev) =>
          prev.map((kol) =>
            kol.kol_id === kol_id && kol.platform === platform ? updated : kol
          )
        );
        toast.success("Successfully updated tracking settings");
        return updated;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update tracking";
        toast.error(message);
        throw err;
      }
    },
    []
  );

  // 取消追踪
  const removeTrack = useCallback(
    async (kol_id: string, platform: Platform) => {
      try {
        await untrackKOL(kol_id, platform);
        setTrackedKOLs((prev) =>
          prev.filter(
            (kol) => !(kol.kol_id === kol_id && kol.platform === platform)
          )
        );
        toast.success(`Successfully untracked ${kol_id}`);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to untrack KOL";
        toast.error(message);
        throw err;
      }
    },
    []
  );

  // 切换追踪状态
  const toggleTrack = useCallback(
    async (kol_id: string, platform: Platform) => {
      try {
        const result = await toggleTrackKOL(kol_id, platform);
        await loadTrackedKOLs(); // 重新加载列表
        toast.success(
          result.isTracking
            ? `Now tracking ${kol_id}`
            : `Stopped tracking ${kol_id}`
        );
        return result.isTracking;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to toggle tracking";
        toast.error(message);
        throw err;
      }
    },
    [loadTrackedKOLs]
  );

  // 检查是否正在追踪
  const isTracking = useCallback(
    (kol_id: string, platform: Platform) => {
      return trackedKOLs.some(
        (kol) => kol.kol_id === kol_id && kol.platform === platform
      );
    },
    [trackedKOLs]
  );

  // 获取特定 KOL 的追踪信息
  const getTrackedKOL = useCallback(
    (kol_id: string, platform: Platform) => {
      return trackedKOLs.find(
        (kol) => kol.kol_id === kol_id && kol.platform === platform
      );
    },
    [trackedKOLs]
  );

  return {
    trackedKOLs,
    isLoading,
    error,
    refresh: loadTrackedKOLs,
    addTrack,
    updateTrack,
    removeTrack,
    toggleTrack,
    isTracking,
    getTrackedKOL,
  };
}
