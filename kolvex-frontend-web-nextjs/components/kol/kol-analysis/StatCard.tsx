"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  colorClass?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  colorClass,
}: StatCardProps) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="!p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center",
              colorClass || "bg-primary/10 text-primary"
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5 mt-2">
          <span className="text-2xl font-bold tabular-nums">{value}</span>
          {subValue && (
            <span className="text-xs text-muted-foreground">{subValue}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

