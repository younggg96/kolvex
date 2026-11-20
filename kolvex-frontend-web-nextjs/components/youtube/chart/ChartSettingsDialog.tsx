"use client";

import { Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoTip } from "@/components/ui/info-tip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  CANDLE_PARTS,
  CHART_COLOR_TOKENS,
  DEFAULT_CHART_SETTINGS,
  tokenColor,
  type CandlePart,
  type ChartColorToken,
  type ChartSettings,
  type CrosshairSnap,
  type ZoomAnchor,
} from "@/lib/chart/settings";

type Translate = (key: string, params?: Record<string, string>) => string;

const k = (key: string) => `youtubeOpinions.chartSettings.${key}`;

/** The advanced chart's ⚙ dialog: zoom, crosshair, extended hours and candle colours. */
export default function ChartSettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
  intraday,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ChartSettings;
  onChange: (next: ChartSettings) => void;
  /** The current interval has intraday bars, so extended hours apply. */
  intraday: boolean;
  t: Translate;
}) {
  const set = (patch: Partial<ChartSettings>) => onChange({ ...settings, ...patch });
  const setPart = (part: CandlePart, patch: Partial<ChartSettings["candles"][CandlePart]>) =>
    onChange({
      ...settings,
      candles: { ...settings.candles, [part]: { ...settings.candles[part], ...patch } },
    });
  const scheme = (up: ChartColorToken, down: ChartColorToken) =>
    onChange({
      ...settings,
      candles: Object.fromEntries(
        CANDLE_PARTS.map((part) => [part, { ...settings.candles[part], up, down }]),
      ) as ChartSettings["candles"],
    });
  const schemeIs = (up: ChartColorToken, down: ChartColorToken) =>
    CANDLE_PARTS.every(
      (part) => settings.candles[part].up === up && settings.candles[part].down === down,
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          title={t(k("open"))}
          aria-label={t(k("open"))}
          variant="toolbar"
          size="toolbar"
          selected={open}
        >
          <Settings2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md"
        // The advanced chart dialog owns Escape; close only this one.
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>{t(k("title"))}</DialogTitle>
        </DialogHeader>

        <Section title={t(k("zoom"))}>
          <RadioRow<ZoomAnchor>
            name="chart-zoom"
            value={settings.zoomAnchor}
            onChange={(zoomAnchor) => set({ zoomAnchor })}
            options={[
              { value: "cursor", label: t(k("zoomCursor")) },
              { value: "right", label: t(k("zoomRight")) },
            ]}
          />
        </Section>

        <Section title={t(k("crosshair"))}>
          <RadioRow<CrosshairSnap>
            name="chart-crosshair"
            value={settings.crosshairSnap}
            onChange={(crosshairSnap) => set({ crosshairSnap })}
            options={[
              { value: "off", label: t(k("snapOff")) },
              { value: "close", label: t(k("snapClose")) },
              { value: "ohlc", label: t(k("snapOhlc")) },
            ]}
          />
        </Section>

        <Section title={t(k("data"))}>
          <ToggleRow
            id="chart-extended-hours"
            label={t(k("extendedHours"))}
            hint={t(k("extendedHoursHint"))}
            checked={settings.extendedHours}
            onCheckedChange={(extendedHours) => set({ extendedHours })}
            muted={!intraday}
          />
          <ToggleRow
            id="chart-highlight-session"
            label={t(k("highlightSession"))}
            checked={settings.highlightSession}
            disabled={!settings.extendedHours}
            onCheckedChange={(highlightSession) => set({ highlightSession })}
          />
        </Section>

        <Section title={t(k("colors"))}>
          <div className="flex flex-wrap gap-1.5 pb-1">
            {(
              [
                ["greenUp", "chart-up", "chart-down"],
                ["redUp", "chart-down", "chart-up"],
              ] as const
            ).map(([label, up, down]) => (
              <button
                key={label}
                type="button"
                aria-pressed={schemeIs(up, down)}
                onClick={() => scheme(up, down)}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-semibold transition-colors focus-visible:outline-none",
                  schemeIs(up, down)
                    ? "border-foreground/30 bg-secondary text-foreground"
                    : "border-border text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
                )}
              >
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: tokenColor(up) }}
                  aria-hidden="true"
                />
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: tokenColor(down) }}
                  aria-hidden="true"
                />
                {t(k(label))}
              </button>
            ))}
          </div>
          {CANDLE_PARTS.map((part) => {
            const paint = settings.candles[part];
            const id = `chart-candle-${part}`;
            return (
              <div key={part} className="flex min-h-11 items-center gap-3">
                <Checkbox
                  id={id}
                  checked={paint.enabled}
                  onCheckedChange={(checked) => setPart(part, { enabled: checked === true })}
                />
                <label htmlFor={id} className="flex-1 text-sm">
                  {t(k(part))}
                </label>
                <Swatch
                  label={`${t(k(part))} · ${t(k("up"))}`}
                  value={paint.up}
                  disabled={!paint.enabled}
                  onChange={(up) => setPart(part, { up })}
                  t={t}
                />
                <Swatch
                  label={`${t(k(part))} · ${t(k("down"))}`}
                  value={paint.down}
                  disabled={!paint.enabled}
                  onChange={(down) => setPart(part, { down })}
                  t={t}
                />
              </div>
            );
          })}
        </Section>

        <DialogFooter className="sm:justify-start">
          <Button type="button" variant="outline" onClick={() => onChange(DEFAULT_CHART_SETTINGS)}>
            {t(k("reset"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-border pt-3 first-of-type:border-t-0 first-of-type:pt-0">
      <h3 className="mb-1.5 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function RadioRow<T extends string>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-x-5 gap-y-1">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-foreground"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 accent-[rgb(var(--primary))]"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  muted,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  /** Still editable, but has no effect on the current interval. */
  muted?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2">
      <label
        htmlFor={id}
        className={cn(
          "flex-1 text-sm",
          disabled || muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {label}
      </label>
      {hint && <InfoTip label={hint}>{hint}</InfoTip>}
      <Switch
        id={id}
        size="lg"
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function Swatch({
  label,
  value,
  disabled,
  onChange,
  t,
}: {
  label: string;
  value: ChartColorToken;
  disabled?: boolean;
  onChange: (value: ChartColorToken) => void;
  t: Translate;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          disabled={disabled}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/50 transition-colors hover:bg-muted focus-visible:outline-none disabled:opacity-40"
        >
          <span
            className="h-3.5 w-3.5 rounded-[3px]"
            style={{ backgroundColor: tokenColor(value) }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-2">
        <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1">
          {CHART_COLOR_TOKENS.map((token, index) => (
            <button
              key={token}
              type="button"
              role="radio"
              aria-checked={value === token}
              aria-label={t(k("swatch"), { index: String(index + 1) })}
              onClick={() => onChange(token)}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-lg focus-visible:outline-none",
                value === token ? "ring-2 ring-foreground/60" : "hover:bg-foreground/[0.06]",
              )}
            >
              <span
                className="h-4 w-4 rounded-[3px]"
                style={{ backgroundColor: tokenColor(token) }}
              />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
