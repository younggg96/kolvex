"use client";

import { Fragment } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { useRegisterHeaderBack } from "./headerBack";

export type BreadcrumbItem =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never }
  | { label: string; href?: never; onClick?: never };

const parentClass =
  "inline-flex min-h-[44px] shrink-0 items-center rounded-md transition-colors duration-150 hover:text-foreground focus-visible:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";

/**
 * Page trail such as `Markets / AMZN`. Items with an `href` or `onClick` are
 * parents; one with neither is the current page. Loading and missing states may
 * pass parents only, so the way back is always available. Phones show only a
 * back control to the nearest parent; the full trail starts at `md`.
 */
export default function PageBreadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  const c = useCopy();
  const parent = [...items].reverse().find(item => item.href || item.onClick);
  // Under the phone source header the back button lives in the header instead.
  const inHeader = useRegisterHeaderBack(parent);
  const backClass = inHeader ? "hidden" : "-ml-2 inline-flex min-h-11 min-w-0 max-w-full items-center gap-0.5 rounded-full pl-1 pr-3 text-[0.9375rem] font-medium text-foreground transition-colors duration-150 active:bg-foreground/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:hidden";
  const backContent = parent && <>
    <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
    <span className="truncate"><span className="sr-only">{c("Back to ", "返回")}</span>{parent.label}</span>
  </>;
  return (
    <nav aria-label={c("Breadcrumb", "面包屑导航")} className={className ?? "min-w-0 flex-1"}>
      {parent?.href ? <Link href={parent.href} className={backClass}>{backContent}</Link>
        : parent?.onClick ? <button type="button" onClick={parent.onClick} className={backClass}>{backContent}</button> : null}
      <ol className={`min-w-0 items-center gap-2 text-sm text-muted-foreground ${parent ? "hidden md:flex" : "flex"}`}>
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
