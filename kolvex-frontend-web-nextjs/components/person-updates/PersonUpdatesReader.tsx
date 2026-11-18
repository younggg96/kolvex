"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { ContentLoading } from "@/components/ui/content-loading";
import { ListCard, ListEmptyState } from "@/components/ui/list-card";
import { FilterSheet, FilterSheetGroup } from "@/components/ui/filter-sheet";
import { useTranslation } from "@/lib/i18n";
import { personUpdatePeople, type PersonUpdate } from "@/lib/personUpdates";
import { PersonUpdatesPeopleRail } from "./PersonUpdatesPeopleRail";
import { PersonUpdateTimeline } from "./PersonUpdateTimeline";

function updateFilters(filters: Partial<Record<"person" | "tag", string>>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(filters)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState(null, "", url);
}

function clearFilters() {
  updateFilters({ person: "", tag: "" });
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
      <ListCard>
        <ListEmptyState
          alert
          title={c("The timeline could not be loaded.", "暂时无法加载人物动态。")}
          action={
            <Button
              variant="outline"
              onClick={() => {
                setFailed(false);
                setAttempt((current) => current + 1);
              }}
            >
              {c("Retry", "重试")}
            </Button>
          }
        />
      </ListCard>
    );

  if (!items) return <PersonUpdatesLoading />;
  if (!items.length)
    return (
      <ListCard>
        <ListEmptyState title={c("No updates yet.", "暂无人物动态。")} />
      </ListCard>
    );

  const people = personUpdatePeople(items, Date.now());
  const tags = Array.from(new Set(items.flatMap((item) => item.tags))).sort((a, b) =>
    a.localeCompare(b),
  );
  const person = search.get("person") || "";
  const tag = search.get("tag") || "";
  const filtered = items.filter(
    (item) => (!person || item.person === person) && (!tag || item.tags.includes(tag)),
  );
  const personLabel = people.find((entry) => entry.name === person)?.label || person;
  const summary = [personLabel, tag].filter(Boolean).join(" · ");
  const personOptions = [
    { value: "", label: c("All people", "全部人物") },
    ...people.map((entry) => ({ value: entry.name, label: entry.label })),
  ];
  if (person && !personOptions.some((entry) => entry.value === person)) {
    personOptions.push({ value: person, label: person });
  }
  const topicOptions = [
    { value: "", label: c("All topics", "全部主题") },
    ...tags.map((value) => ({ value, label: value })),
  ];
  if (tag && !tags.includes(tag)) topicOptions.push({ value: tag, label: tag });

  return (
    <div className="min-w-0 space-y-4">
      <PersonUpdatesPeopleRail
        people={people}
        selected={person}
        onSelect={(value) => updateFilters({ person: value })}
      />
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <p role="status" className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {c(
              `${filtered.length} ${filtered.length === 1 ? "update" : "updates"}`,
              `${filtered.length} 条动态`,
            )}
          </p>
          {tag && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 min-w-0 gap-1.5 rounded-full"
              aria-label={c(`Remove topic ${tag}`, `移除主题 ${tag}`)}
              onClick={() => updateFilters({ tag: "" })}
            >
              <span className="min-w-0 truncate">{tag}</span>
              <X aria-hidden="true" className="size-3.5 shrink-0" />
            </Button>
          )}
        </div>
        <FilterSheet
          allScreens
          title={c("Filter updates", "筛选动态")}
          triggerLabel={c("Filters", "筛选")}
          summary={summary || undefined}
          active={Boolean(person || tag)}
          onReset={clearFilters}
        >
          <FilterSheetGroup
            label={c("Person", "人物")}
            options={personOptions}
            value={person}
            onChange={(value) => updateFilters({ person: value })}
          />
          <FilterSheetGroup
            label={c("Topic", "主题")}
            options={topicOptions}
            value={tag}
            onChange={(value) => updateFilters({ tag: value })}
          />
        </FilterSheet>
      </div>
      {filtered.length ? (
        <PersonUpdateTimeline items={filtered} />
      ) : (
        <ListCard>
          <ListEmptyState
            title={c("No updates match these filters.", "没有符合筛选条件的动态。")}
            action={
              <Button variant="outline" onClick={clearFilters}>
                {c("Clear filters", "清除筛选")}
              </Button>
            }
          />
        </ListCard>
      )}
    </div>
  );
}
