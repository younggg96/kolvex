"use client";

import { useId, useRef, useState } from "react";
import { SlidersHorizontal, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TECHNICAL_CATEGORIES, DEFAULT_TECHNICAL_FOCUS, DEFAULT_DRAWING_FOCUS, DRAWING_CATEGORIES, type TechnicalFocus } from "@/lib/technicalFocus";

type Translate = (key: string, params?: Record<string, string>) => string;
const limitedCategories = new Set(["timeframes", "score", "historical"]);

export default function TechnicalFocusSelector({ value: savedValue, onChange: saveValue, disabled, t, drawings = false }: {
  value: TechnicalFocus;
  onChange: (value: TechnicalFocus) => void;
  disabled: boolean;
  t: Translate;
  drawings?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [value, onChange] = useState(savedValue);
  const defaults = drawings ? DEFAULT_DRAWING_FOCUS : DEFAULT_TECHNICAL_FOCUS;
  const title = t(drawings ? "youtubeOpinions.ai.focus.drawingTitle" : "youtubeOpinions.ai.focus.title");
  const addButton = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(false);
  const count = value.categories.length + value.custom_scenarios.length;
  const names = [...savedValue.categories.map(key => t(`youtubeOpinions.ai.focus.categories.${key}`)), ...savedValue.custom_scenarios];
  const preview = names.slice(0, 2).join(" / ");
  const remaining = names.length - Math.min(names.length, 2);

  function add() {
    const text = draft.trim();
    if (!text || value.custom_scenarios.includes(text) || value.custom_scenarios.length >= 5) {
      setError(true);
      return;
    }
    onChange({ ...value, custom_scenarios: [...value.custom_scenarios, text] });
    setDraft("");
    setError(false);
    setAdding(false);
    requestAnimationFrame(() => addButton.current?.focus());
  }

  function categoryOptions(limited: boolean) {
    return (drawings ? DRAWING_CATEGORIES : TECHNICAL_CATEGORIES).filter(key => limitedCategories.has(key) === limited).map(key => {
      const selected = value.categories.includes(key);
      return (
        <label key={key} htmlFor={`${id}-${key}`} className="flex min-h-10 min-w-0 cursor-pointer items-center gap-2.5 py-1 text-sm text-foreground has-[:disabled]:cursor-default has-[:disabled]:opacity-50">
          <Checkbox id={`${id}-${key}`} checked={selected} disabled={disabled || (selected && count === 1)}
            onCheckedChange={() => onChange({ ...value, categories: selected ? value.categories.filter(item => item !== key) : [...value.categories, key] })} />
          <span>{t(`youtubeOpinions.ai.focus.categories.${key}`)}</span>
        </label>
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={next => {
      if (next) { onChange({ categories: [...savedValue.categories], custom_scenarios: [...savedValue.custom_scenarios] }); setDraft(""); setAdding(false); setError(false); }
      setOpen(next);
    }}>
      <DialogTrigger asChild>
        <button type="button" disabled={disabled} className="flex min-h-11 w-full items-center gap-3 rounded text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">
          <span className="shrink-0 font-medium">{title}</span>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {preview}{remaining > 0 && `${preview ? " · " : ""}+${remaining}`}
          </span>
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl" onEscapeKeyDown={event => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t(drawings ? "youtubeOpinions.ai.focus.drawingHint" : "youtubeOpinions.ai.focus.hint")}</DialogDescription>
        </DialogHeader>
      <fieldset disabled={disabled} className="min-w-0 pb-4 pt-1">
        <legend className="sr-only">{title}</legend>
        <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">{categoryOptions(false)}</div>
        {!drawings && <div className="mt-5 border-t border-border pt-4">
          <h4 className="mb-2 text-sm font-medium">
            {t("youtubeOpinions.ai.focus.more")}
          </h4>
          <p className="mb-1 text-xs leading-5 text-muted-foreground">{t("youtubeOpinions.ai.focus.limits")}</p>
          <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">{categoryOptions(true)}</div>
        </div>}
        {!drawings && value.custom_scenarios.length > 0 && (
          <ul className="mt-3 space-y-1">
            {value.custom_scenarios.map((text, index) => (
              <li key={text} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 break-words leading-6">{text}</span>
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={disabled || count === 1}
                  aria-label={t("youtubeOpinions.ai.focus.remove", { name: text })}
                  onClick={() => onChange({ ...value, custom_scenarios: value.custom_scenarios.filter((_, i) => i !== index) })}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        {!drawings && (adding ? (
          <div className="mt-3">
            <label htmlFor={`${id}-custom`} className="sr-only">{t("youtubeOpinions.ai.focus.custom")}</label>
            <div className="flex items-center gap-2">
              <Input id={`${id}-custom`} autoFocus value={draft} maxLength={200} disabled={disabled}
                className="flex-1" placeholder={t("youtubeOpinions.ai.focus.placeholder")}
                aria-invalid={error} aria-describedby={`${id}-help`}
                onChange={event => { setDraft(event.target.value); setError(false); }}
                onKeyDown={event => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); add(); }
                  if (event.key === "Escape" && !event.nativeEvent.isComposing) {
                    event.preventDefault(); event.stopPropagation(); setAdding(false); setError(false);
                    requestAnimationFrame(() => addButton.current?.focus());
                  }
                }} />
              <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" disabled={disabled || !draft.trim()} onClick={add}>
                {t("youtubeOpinions.ai.focus.add")}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" disabled={disabled}
                aria-label={t("common.cancel")} onClick={() => { setAdding(false); setError(false); requestAnimationFrame(() => addButton.current?.focus()); }}>
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
            <p id={`${id}-help`} className="mt-1.5 text-xs leading-5 text-muted-foreground" role={error ? "alert" : undefined}>
              {t(error ? "youtubeOpinions.ai.focus.invalid" : "youtubeOpinions.ai.focus.customHint")}
            </p>
          </div>
        ) : (
          <Button ref={addButton} type="button" variant="ghost" size="sm" className="mt-2 -ml-2 gap-1.5 text-muted-foreground"
            disabled={disabled || value.custom_scenarios.length >= 5} onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />{t("youtubeOpinions.ai.focus.addScenario")}
          </Button>
        ))}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{t(drawings ? "youtubeOpinions.ai.focus.drawingApplyHint" : "youtubeOpinions.ai.focus.applyHint", { count: String(count) })}</span>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground" disabled={disabled}
            onClick={() => { onChange(defaults); setDraft(""); setAdding(false); setError(false); }}>
            {t("youtubeOpinions.ai.focus.reset")}
          </Button>
        </div>
      </fieldset>
      <DialogFooter className="gap-2 border-t border-border">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
        <Button type="button" disabled={disabled || count === 0} onClick={() => { saveValue(value); setOpen(false); }}>{t("youtubeOpinions.ai.focus.apply")}</Button>
      </DialogFooter>
    </DialogContent>
    </Dialog>
  );
}
