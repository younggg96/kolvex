"use client";

import { useId, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TECHNICAL_CATEGORIES, DEFAULT_TECHNICAL_FOCUS, type TechnicalFocus } from "@/lib/technicalFocus";

type Translate = (key: string, params?: Record<string, string>) => string;
const limitedCategories = new Set(["patterns", "timeframes", "score", "historical"]);

export default function TechnicalFocusSelector({ value, onChange, disabled, t }: {
  value: TechnicalFocus;
  onChange: (value: TechnicalFocus) => void;
  disabled: boolean;
  t: Translate;
}) {
  const id = useId();
  const addButton = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(false);
  const count = value.categories.length + value.custom_scenarios.length;
  const names = [...value.categories.map(key => t(`youtubeOpinions.ai.focus.categories.${key}`)), ...value.custom_scenarios];
  const preview = names.slice(0, 2).join(" / ");
  const remaining = count - Math.min(names.length, 2);

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
    return TECHNICAL_CATEGORIES.filter(key => limitedCategories.has(key) === limited).map(key => {
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
    <details className="group/focus mb-4 border-b border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 font-medium">{t("youtubeOpinions.ai.focus.title")}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {preview}{remaining > 0 && `${preview ? " · " : ""}+${remaining}`}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground group-open/focus:rotate-180" aria-hidden="true" />
      </summary>
      <fieldset disabled={disabled} className="min-w-0 pb-4 pt-1">
        <legend className="sr-only">{t("youtubeOpinions.ai.focus.title")}</legend>
        <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">{categoryOptions(false)}</div>
        <details className="mt-2">
          <summary className="w-fit cursor-pointer rounded py-2 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            {t("youtubeOpinions.ai.focus.more")}
          </summary>
          <p className="mb-1 text-xs leading-5 text-muted-foreground">{t("youtubeOpinions.ai.focus.limits")}</p>
          <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">{categoryOptions(true)}</div>
        </details>
        {value.custom_scenarios.length > 0 && (
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
        {adding ? (
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
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{t("youtubeOpinions.ai.focus.applyHint", { count: String(count) })}</span>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground" disabled={disabled}
            onClick={() => { onChange(DEFAULT_TECHNICAL_FOCUS); setDraft(""); setAdding(false); setError(false); }}>
            {t("youtubeOpinions.ai.focus.reset")}
          </Button>
        </div>
      </fieldset>
    </details>
  );
}
