"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ContentLoading } from "@/components/ui/content-loading";
import { ListEmptyState } from "@/components/ui/list-card";
import { cn } from "@/lib/utils";
import { useCopy } from "./shared";

/** Section chrome shared by every block on the search discovery page. */
function ViewAll({ href, label }: { href: string; label: string }) {
  const c = useCopy();
  return (
    <Link
      href={href}
      aria-label={label}
      className="group flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground transition-colors hover:text-foreground active:bg-foreground/[0.1] motion-reduce:transition-none"
    >
      {c("View all", "查看全部")}
    </Link>
  );
}

export function DiscoverySection({
  id,
  title,
  icon,
  href,
  linkLabel,
  className,
  children,
}: {
  id: string;
  title: string;
  icon?: ReactNode;
  href?: string;
  linkLabel?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("flex min-w-0 flex-col [&>:last-child]:flex-1", className)}
    >
      <header className="mb-3 flex min-h-11 items-center justify-between gap-4 max-lg:mb-0.5">
        <h2
          id={id}
          className="flex min-w-0 items-center gap-1.5 text-base font-semibold tracking-tight lg:gap-2 lg:text-lg"
        >
          {icon}
          {title}
        </h2>
        {href && <ViewAll href={href} label={linkLabel || title} />}
      </header>
      {children}
    </section>
  );
}

export function SourceState({
  loading,
  error,
  retry,
  className,
  skeleton,
}: {
  loading: boolean;
  error: unknown;
  retry: () => void;
  className?: string;
  skeleton: ReactNode;
}) {
  const c = useCopy();
  if (loading) return <ContentLoading className="min-h-0">{skeleton}</ContentLoading>;
  return (
    <div className={cn("flex min-h-40 items-center justify-center", className)}>
      {
        <ListEmptyState
          title={
            error
              ? c("This source is unavailable", "这个来源暂时不可用")
              : c("Nothing here yet", "暂时还没有内容")
          }
          action={
            error ? (
              <Button type="button" variant="outline" size="sm" onClick={retry}>
                {c("Retry", "重试")}
              </Button>
            ) : undefined
          }
          alert={Boolean(error)}
        />
      }
    </div>
  );
}

export function PartialError({ error, retry }: { error: unknown; retry: () => void }) {
  const c = useCopy();
  if (!error) return null;
  return (
    <p
      role="status"
      className="flex flex-wrap items-center gap-x-2 px-2 pt-2 text-xs text-muted-foreground"
    >
      {c("Showing saved content. Refresh failed.", "刷新失败，当前显示已加载内容。")}
      <button
        type="button"
        onClick={retry}
        className="min-h-9 rounded-full px-2 font-medium text-foreground underline underline-offset-4"
      >
        {c("Retry", "重试")}
      </button>
    </p>
  );
}
