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

/** One row: label on the left, control on the right. */
export function SettingsRow({
  label,
  icon: Icon,
  children,
  className,
}: {
  label: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[3.25rem] items-center justify-between gap-4 px-4 py-2.5", className)}>
      <div className="flex shrink-0 items-center gap-2 text-[0.9375rem] font-medium text-foreground">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {label}
      </div>
      <div className="flex min-w-0 flex-1 justify-end text-right text-[0.9375rem] text-muted-foreground">{children}</div>
    </div>
  );
}
