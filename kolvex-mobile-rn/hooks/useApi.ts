/**
 * Generic data fetching hook with loading, error, and refresh support
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface UseApiOptions {
  /** Whether to fetch on mount */
  immediate?: boolean;
  /** Dependencies that trigger refetch */
  deps?: unknown[];
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

export function useApi<T>(
  fetcher: () => Promise<T>,
  options: UseApiOptions = {}
): UseApiResult<T> {
  const { immediate = true, deps = [] } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) {
        setData(result);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetcher]);

  useEffect(() => {
    mountedRef.current = true;
    if (immediate) {
      fetchData();
    }
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh, setData };
}

/**
 * Paginated data fetching hook
 */
interface UsePaginatedApiOptions {
  pageSize?: number;
  immediate?: boolean;
}

interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

interface UsePaginatedApiResult<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  page: number;
}

export function usePaginatedApi<T>(
  fetcher: (page: number, pageSize: number) => Promise<PaginatedResult<T>>,
  options: UsePaginatedApiOptions = {}
): UsePaginatedApiResult<T> {
  const { pageSize = 20, immediate = true } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(immediate);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const mountedRef = useRef(true);

  const fetchPage = useCallback(async (pageNum: number, isRefresh: boolean) => {
    if (isRefresh) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const result = await fetcher(pageNum, pageSize);
      if (mountedRef.current) {
        if (isRefresh) {
          setData(result.items);
        } else {
          // Deduplicate by checking for items with the same identity
          setData(prev => {
            const existingIds = new Set(prev.map((item: any) => item.id ?? item));
            const newItems = result.items.filter((item: any) => !existingIds.has(item.id ?? item));
            return [...prev, ...newItems];
          });
        }
        setTotal(result.total);
        setHasMore(result.hasMore);
        setPage(pageNum);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [fetcher, pageSize]);

  useEffect(() => {
    mountedRef.current = true;
    if (immediate) {
      fetchPage(1, true);
    }
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    await fetchPage(1, true);
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!loadingMore && hasMore) {
      await fetchPage(page + 1, false);
    }
  }, [loadingMore, hasMore, page, fetchPage]);

  return { data, loading, loadingMore, error, hasMore, total, refresh, loadMore, page };
}
