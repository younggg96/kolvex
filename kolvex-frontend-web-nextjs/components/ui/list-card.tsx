import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Canonical list-card shell. The Markets "Stock watch" card is the reference:
 * one 24px card on the page background, 12–16px inner padding, controls and
 * column headings inside the card, hoverable rows, and footer actions.
 * Every collection list (watchlist, KOL opinions, X, Reddit, news, holdings…)
 * uses this shell so lists read as the same surface across the workspace.
 */
export const ListCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <Card
    ref={ref}
    className={cn("min-w-0 p-3 sm:p-4", className)}
    {...props}
  />
));
ListCard.displayName = "ListCard";

/** Compact empty/error content inside a ListCard, without another boxed surface. */
export function ListEmptyState({
  title,
  description,
  action,
  alert = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <div role={alert ? "alert" : "status"} className="space-y-2 px-2 py-6 text-sm max-md:px-0">
      <p className="font-medium text-foreground">{title}</p>
      {description && <p className="max-w-prose leading-6 text-muted-foreground">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

/** Title row for a list card: label/scope on the start side, count/sort on the end side. */
export function ListToolbar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-4 gap-y-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Column headings above the rows. Visual only; each row repeats its own labels. */
export function ListColumnHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex items-center gap-1 border-b border-border pr-2 text-xs text-muted-foreground max-md:!px-0 max-md:[&>*]:!px-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The list body. Rows control their own dividers; the canonical card keeps none. */
export function ListRows({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul className={cn("min-w-0", className)} {...props} />;
}

/**
 * A hoverable list row matching the Markets stock rows. The trailing action
 * (watch star, disclosure) sits beside the row target, never nested inside it.
 * Hover and keyboard focus inside the row apply a neutral wash; pressing the
 * row deepens it. Mouse focus left behind by a click does not keep the wash,
 * so the row never sticks grey or flashes when the pointer leaves. Grey keeps the row reading as a control rather than a signal.
 * The row owns the only wash: the link that fills it never adds its own grey.
 */
export const ListRow = React.forwardRef<
  HTMLLIElement,
  React.LiHTMLAttributes<HTMLLIElement>
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn(
      "flex items-center gap-1 rounded-2xl pr-2 max-md:pr-0 max-md:[&>*]:!px-0 transition-colors hover:bg-foreground/[0.06] has-[:focus-visible]:bg-foreground/[0.06] active:bg-foreground/[0.1] motion-reduce:transition-none [&>a]:!bg-transparent",
      className,
    )}
    {...props}
  />
));
ListRow.displayName = "ListRow";

/**
 * Shared classes for the primary link/button that fills a ListRow. The consumer
 * adds its own display/grid classes so stock rows, feed rows and compact rails
 * can all share the same height, corner and focus treatment.
 */
export const listRowTargetClass =
  "list-control min-h-20 min-w-0 flex-1 items-center rounded-2xl px-2 py-2 max-md:min-h-0 max-md:px-0 max-md:py-2 outline-offset-2 focus-visible:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:outline-primary";

/**
 * Long-reading rows (opinions, posts) keep a hairline so prose stays scannable.
 * The hairline darkens and the row takes a faint neutral wash on hover or
 * keyboard focus, matching the compact list rows.
 */
export const listFeedRowClass =
  "list-row-interactive min-w-0 py-2.5 first:pt-2 last:border-0 [overflow-wrap:anywhere]";

/**
 * Feed row that holds its own hoverable rows (e.g. a video with one row per
 * stock opinion). The inner rows carry the wash, so the wrapper stays flat.
 */
export const listFeedGroupRowClass = cn(listFeedRowClass, "list-row-group");

/** Centered "load more" footer of a list card. While `loading`, `skeleton` (rows shaped like the list's own) stands in for the next page and the button is disabled. */
export function ListLoadMore({
  className,
  children,
  loading = false,
  skeleton,
  disabled,
  ...props
}: React.ComponentProps<typeof Button> & { loading?: boolean; skeleton?: React.ReactNode }) {
  return (
    <>
      {loading && skeleton}
      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          className={cn("min-h-8", className)}
          disabled={disabled || loading}
          {...props}
        >
          {children}
        </Button>
      </div>
    </>
  );
}

/** Top-divided footer link inside a list card, e.g. "View all opinions". */
export function ListFooterLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group/footer mt-2 flex min-h-11 items-center justify-between gap-3 border-t border-border px-1 pt-2 max-md:px-0 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:text-foreground",
        className,
      )}
    >
      {children}
      <ArrowUpRight
        className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover/footer:-translate-y-0.5 group-hover/footer:translate-x-0.5 group-hover/footer:text-foreground motion-reduce:transition-none"
        aria-hidden="true"
      />
    </Link>
  );
}

/** Compact row for secondary rails (holdings, recent changes) inside a list card. */
export const listCompactRowClass =
  "list-control flex min-h-10 items-center justify-between gap-2 rounded-xl px-1 py-1.5 text-sm transition-colors duration-150 hover:bg-foreground/[0.06] focus-visible:bg-foreground/[0.06] focus-visible:outline-none active:bg-foreground/[0.1]";
