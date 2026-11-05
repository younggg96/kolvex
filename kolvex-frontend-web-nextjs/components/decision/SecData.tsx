"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCachedResource } from "@/hooks/useCachedResource";
import { secSourceUrl } from "@/lib/freeResearch";
import { loadFundamentals } from "@/lib/stockFundamentals";
import { useCopy } from "./shared";

/** SEC reads are rate limited and can take a while the first time; keep them cached. */
export function useFreeResearch<T>(key: string) {
  return useCachedResource(
    key,
    (signal) => loadFundamentals<T>(key, signal),
    { ttl: 600_000, timeout: 50_000 },
  );
}

/** A 404 means the source has no such security, which is an empty state and not a failure. */
export const isMissing = (error: unknown) =>
  (error as { status?: number } | null)?.status === 404;

export function SecState({
  loading,
  error,
  empty,
  retry,
  emptyText,
  errorText,
}: {
  loading: boolean;
  error: unknown;
  empty: boolean;
  retry: () => void;
  emptyText: string;
  errorText: string;
}) {
  const c = useCopy();
  if (loading)
    return (
      <div role="status" className="space-y-4 py-4">
        <span className="sr-only">{c("Loading…", "正在加载…")}</span>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  const failed = Boolean(error) && !isMissing(error);
  if (!failed && !empty && !error) return null;
  return (
    <div
      role={failed ? "alert" : "status"}
      className="glass-card bg-card-glass rounded-3xl border border-foreground/10 px-6 py-12 text-center"
    >
      <p className="text-sm text-muted-foreground">
        {failed ? errorText : emptyText}
      </p>
      {failed && (
        <Button variant="outline" size="sm" className="mt-4" onClick={retry}>
          {c("Retry", "重试")}
        </Button>
      )}
    </div>
  );
}

/** Links only to validated sec.gov archive paths; anything else renders as plain text. */
export function SecLink({
  href,
  children,
  label,
}: {
  href: string | undefined;
  children: ReactNode;
  label?: string;
}) {
  const safe = secSourceUrl(href);
  if (!safe) return <>{children}</>;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground"
    >
      {children}
    </a>
  );
}

export function SourceNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs leading-5 text-muted-foreground">{children}</p>
  );
}

export function FactList({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-2 gap-6 border-b border-border pb-6 lg:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="figure mt-2 break-words text-lg font-semibold">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
