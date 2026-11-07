import { useState } from "react";
import { ButtonsSkeleton } from "./Skeletons";
import { apiRequest } from "../lib/http";
import { useResource } from "../lib/useResource";
import { marketCalendarDate } from "../lib/marketObservations";
import { Button, Copy, Glass } from "./UI";
import { Field, ResourceState } from "./Content";
import DateField from "./native/DateField";
import { briefNames } from "../lib/contentTypes";
export function BriefCalendar({
  user,
  value,
  onChange,
}: {
  user: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(marketCalendarDate().slice(0, 7));
  const r = useResource(`brief-calendar:${user}:${month}`, (signal) =>
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month)
      ? apiRequest<{ days: { date: string; types: string[] }[] }>(
          `/briefs/calendar?month=${month}`,
          { signal, authenticated: true, expectedUser: user },
        )
      : Promise.resolve({ days: [] }),
  );
  return (
    <Glass style={{ padding: 16, gap: 12 }}>
      <Copy bold>阅读日期 · {value || "全部日期"}</Copy>
      <Button onPress={() => setOpen((v) => !v)}>
        {open ? "收起日历" : "选择日期 / 查看期次"}
      </Button>
      {open && (
        <>
          <DateField
            key={value || "all"}
            label="选择日报日期"
            value={value}
            onChange={(v) => {
              onChange(v);
              setMonth(v.slice(0, 7));
            }}
          />
          <Field
            label="查看有日报的月份 YYYY-MM"
            value={month}
            onChangeText={setMonth}
          />
          <ResourceState skeleton={<ButtonsSkeleton count={7} />}
            resource={r}
            empty={!r.data?.days.length}
            message="此月没有日报"
          />
          {r.data?.days.map((day) => (
            <Button
              key={day.date}
              selected={value === day.date}
              onPress={() => onChange(day.date)}
            >
              {day.date} ·{day.types.map((t) => briefNames[t] || t).join(" / ")}
            </Button>
          ))}
        </>
      )}
      {value && <Button onPress={() => onChange("")}>查看全部日期</Button>}
    </Glass>
  );
}
