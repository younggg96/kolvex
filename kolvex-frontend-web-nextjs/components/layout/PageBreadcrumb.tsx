"use client";

import { Fragment } from "react";
import Link from "next/link";
import { useCopy } from "@/components/decision/shared";

export type BreadcrumbItem =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never }
  | { label: string; href?: never; onClick?: never };

const parentClass =
  "inline-flex min-h-[44px] shrink-0 items-center rounded-md transition-colors duration-150 hover:text-foreground focus-visible:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

/**
 * Page trail such as `Markets / AMZN`. Items with an `href` or `onClick` are
 * parents; one with neither is the current page. Loading and missing states may
 * pass parents only, so the way back is always available.
 */
export default function PageBreadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  const c = useCopy();
  return (
    <nav aria-label={c("Breadcrumb", "面包屑导航")} className={className ?? "min-w-0"}>
      <ol className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        {items.map((item, index) => (
          <Fragment key={`${index}-${item.label}`}>
            {index > 0 && <li aria-hidden="true" className="shrink-0">/</li>}
            <li className={item.href || item.onClick ? "shrink-0" : "min-w-0"}>
              {item.href ? (
                <Link href={item.href} className={parentClass}>{item.label}</Link>
              ) : item.onClick ? (
                <button type="button" onClick={item.onClick} className={parentClass}>{item.label}</button>
              ) : (
                <span aria-current="page" title={item.label} className="block truncate text-foreground">{item.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
