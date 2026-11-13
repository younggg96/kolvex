import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small muted group label above a rounded card of rows. */
export function SettingsGroup({
  label,
  action,
  children,
  className,
}: {
  label?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      {(label || action) && (
        <div className="flex items-center justify-between gap-3 px-1">
          {label && <h3 className="text-[0.8125rem] font-medium text-muted-foreground">{label}</h3>}
          {action}
        </div>
      )}
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {children}
      </div>
    </section>
  );
}

/**
 * One row: label on the left, control on the right.
 * `stacked` puts the label above a full-width control — use it for text inputs being edited.
 * `input` does the same below the `sm` breakpoint only, so wide controls never get squeezed on phones.
 */
export function SettingsRow({
  label,
  icon: Icon,
  stacked,
  input,
  children,
  className,
}: {
  label: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  stacked?: boolean;
  input?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const labelNode = (
    <div className={cn("flex min-w-0 items-center gap-2 text-[0.9375rem] font-medium text-foreground", typeof label === "string" && "shrink-0")}>
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      {label}
    </div>
  );
  if (stacked) {
    return (
      <div className={cn("space-y-2 px-4 py-3", className)}>
        {labelNode}
        <div className="min-w-0 text-[0.9375rem]">{children}</div>
      </div>
    );
  }
  if (input) {
    return (
      <div className={cn("flex min-h-[3.25rem] flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-2.5", className)}>
        {labelNode}
        <div className="flex min-w-0 flex-1 text-[0.9375rem] sm:justify-end [&>*]:w-full sm:[&>*]:max-w-[17.5rem]">{children}</div>
      </div>
    );
  }
  return (
    <div className={cn("flex min-h-[3.25rem] items-center justify-between gap-4 px-4 py-2.5", className)}>
      {labelNode}
      <div className="flex min-w-0 flex-1 justify-end text-right text-[0.9375rem] text-muted-foreground">{children}</div>
    </div>
  );
}
