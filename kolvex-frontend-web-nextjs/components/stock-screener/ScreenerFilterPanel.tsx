"use client";

import { useCallback } from "react";
import { X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  FILTER_DEFINITIONS,
  SECTOR_OPTIONS,
  type RangeFilter,
} from "@/lib/stockScreenerApi";

interface ScreenerFilterPanelProps {
  filters: Record<string, RangeFilter>;
  onFiltersChange: (filters: Record<string, RangeFilter>) => void;
  selectedSectors: string[];
  onSectorsChange: (sectors: string[]) => void;
  onApply: () => void;
  locale: string;
}

export default function ScreenerFilterPanel({
  filters,
  onFiltersChange,
  selectedSectors,
  onSectorsChange,
  onApply,
  locale,
}: ScreenerFilterPanelProps) {
  const isZh = locale === "zh";

  const updateFilter = useCallback(
    (key: string, bound: "min" | "max", value: string) => {
      const num = value === "" ? undefined : Number(value);
      const existing = filters[key] || {};
      const updated = { ...existing, [bound]: num };

      if (updated.min === undefined && updated.max === undefined) {
        const next = { ...filters };
        delete next[key];
        onFiltersChange(next);
      } else {
        onFiltersChange({ ...filters, [key]: updated });
      }
    },
    [filters, onFiltersChange]
  );

  const toggleSector = useCallback(
    (sector: string) => {
      if (selectedSectors.includes(sector)) {
        onSectorsChange(selectedSectors.filter((s) => s !== sector));
      } else {
        onSectorsChange([...selectedSectors, sector]);
      }
    },
    [selectedSectors, onSectorsChange]
  );

  const clearAll = useCallback(() => {
    onFiltersChange({});
    onSectorsChange([]);
  }, [onFiltersChange, onSectorsChange]);

  const activeCount =
    Object.keys(filters).length + selectedSectors.length;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {isZh ? "自定义筛选" : "Custom Filters"}
          {activeCount > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-bold text-primary">
              {activeCount}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <Button variant="ghost" size="xs" onClick={clearAll}>
              <RotateCcw className="w-3 h-3 mr-1" />
              {isZh ? "重置" : "Reset"}
            </Button>
          )}
          <Button size="xs" onClick={onApply}>
            {isZh ? "应用筛选" : "Apply Filters"}
          </Button>
        </div>
      </div>

      {/* Sector chips */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          {isZh ? "行业" : "Sector"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SECTOR_OPTIONS.map((sector) => {
            const active = selectedSectors.includes(sector);
            return (
              <button
                key={sector}
                type="button"
                onClick={() => toggleSector(sector)}
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {sector}
              </button>
            );
          })}
        </div>
      </div>

      {/* Range filter groups */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FILTER_DEFINITIONS.map((group) => (
          <div key={group.group} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">
              {isZh ? group.group_zh : group.group}
            </p>
            {group.fields.map((field) => {
              const f = filters[field.key] || {};
              return (
                <div key={field.key} className="flex items-center gap-1.5">
                  <span className="w-24 truncate text-[11px] text-muted-foreground">
                    {isZh ? field.label_zh : field.label}
                  </span>
                  <Input
                    type="number"
                    placeholder="Min"
                    className="h-7 text-xs w-20"
                    step={field.step}
                    value={f.min ?? ""}
                    onChange={(e) =>
                      updateFilter(field.key, "min", e.target.value)
                    }
                  />
                  <span className="text-muted-foreground text-[10px]">–</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    className="h-7 text-xs w-20"
                    step={field.step}
                    value={f.max ?? ""}
                    onChange={(e) =>
                      updateFilter(field.key, "max", e.target.value)
                    }
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
