"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { ContentLoading } from "@/components/ui/content-loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/lib/i18n";
import type { PersonUpdate } from "@/lib/personUpdates";
import { PersonUpdateTimeline } from "./PersonUpdateTimeline";

const ALL = "";
const ALL_OPTION = "all";
const option = (value: string) => (value ? `filter:${value}` : ALL_OPTION);

function TrackerFilter({
  label,
  allLabel,
  choices,
  name,
}: {
  label: string;
  allLabel: string;
  choices: [string, string][];
  name: "person" | "tag";
}) {
  const params = useSearchParams();
  const selection = params.get(name) || ALL;
  return (
    <Select
      value={option(selection)}
      onValueChange={(value) => {
        const url = new URL(window.location.href);
        if (value === ALL_OPTION) url.searchParams.delete(name);
        else url.searchParams.set(name, value.slice("filter:".length));
        window.history.replaceState(null, "", url);
      }}
    >
      <SelectTrigger aria-label={label} className="min-h-11">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_OPTION}>{allLabel}</SelectItem>
        {selection && !choices.some(([value]) => value === selection) && (
          <SelectItem value={option(selection)}>{selection}</SelectItem>
        )}
        {choices.map(([value, title]) => (
          <SelectItem key={value} value={option(value)}>
            {title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PersonUpdatesTitle() {
  const { t } = useTranslation();
  return (
    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("sidebar.personUpdates")}</h1>
  );
}

export function PersonUpdatesLoading() {
  const c = useCopy();
  const label = c("Loading person updates…", "正在加载人物动态…");
  return (
    <ContentLoading label={label}>
      <span className="text-sm text-muted-foreground">{label}</span>
    </ContentLoading>
  );
}

export function PersonUpdatesReader() {
  const c = useCopy();
  const search = useSearchParams();
  const [items, setItems] = useState<PersonUpdate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/person-updates", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Timeline unavailable");
        const data: { items: PersonUpdate[] } = await response.json();
        if (!controller.signal.aborted) setItems(data.items);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [attempt]);

  if (failed)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <p>{c("The timeline could not be loaded.", "暂时无法加载人物动态。")}</p>
        <Button
          variant="outline"
          onClick={() => {
            setFailed(false);
            setAttempt((current) => current + 1);
          }}
        >
          {c("Retry", "重试")}
        </Button>
      </div>
    );

  if (!items) return <PersonUpdatesLoading />;
  if (!items.length)
    return (
      <p className="text-sm text-muted-foreground">{c("No updates yet.", "暂无人物动态。")}</p>
    );

  const people = new Map<string, string>();
  const tags = new Set<string>();
  for (const item of items) {
    if (!people.has(item.person)) people.set(item.person, item.person_cn);
    for (const tag of item.tags) tags.add(tag);
  }
  const person = search.get("person");
  const tag = search.get("tag");
  const filtered = items.filter(
    (item) => (!person || item.person === person) && (!tag || item.tags.includes(tag)),
  );
  return (
    <div className="space-y-5">
      <div className="grid max-w-lg grid-cols-2 gap-3">
        <TrackerFilter
          name="person"
          label={c("Filter by person", "按人物筛选")}
          allLabel={c("All people", "全部人物")}
          choices={[...people].sort((a, b) => a[1].localeCompare(b[1]))}
        />
        <TrackerFilter
          name="tag"
          label={c("Filter by tag", "按标签筛选")}
          allLabel={c("All tags", "全部标签")}
          choices={[...tags].sort((a, b) => a.localeCompare(b)).map((value) => [value, value])}
        />
      </div>
      {filtered.length ? (
        <PersonUpdateTimeline items={filtered} />
      ) : (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <p>{c("No updates match these filters.", "没有符合筛选条件的动态。")}</p>
          <Button
            variant="outline"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.delete("person");
              url.searchParams.delete("tag");
              window.history.replaceState(null, "", url);
            }}
          >
            {c("Clear filters", "清除筛选")}
          </Button>
        </div>
      )}
    </div>
  );
}
