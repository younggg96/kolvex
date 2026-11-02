import { useEffect, useEffectEvent, useState } from "react";
import { apiRequest } from "../lib/http";
import { useAuth } from "../state/Auth";
import { useResource } from "../lib/useResource";
import { useMutation } from "../lib/useMutation";
import type { Drawing, PriceBar } from "../lib/technicalTypes";
import { Button, Copy, Glass, Section } from "./UI";
import { Field, Filters, ResourceState } from "./Content";
import { MutationStatus } from "./MutationStatus";
import { ConfirmAction } from "./ConfirmAction";
export function DrawingEditor({
  symbol,
  bar,
  onChange,
}: {
  symbol: string;
  bar?: PriceBar;
  onChange: (drawings: Drawing[]) => void;
}) {
  const user = useAuth().session!.user.id;
  const r = useResource(`drawings:${user}:${symbol}`, (signal) =>
    apiRequest<{ drawings: Drawing[]; updated_at?: string }>(
      `/chart-drawings/${symbol}`,
      { signal, authenticated: true, expectedUser: user },
    ),
  );
  const [local, setLocal] = useState<Drawing[]>();
  const rows = local ?? r.data?.drawings ?? [];
  const [type, setType] = useState<Drawing["type"]>("trend");
  const [time1, setTime1] = useState("");
  const [time2, setTime2] = useState("");
  const [price1, setPrice1] = useState("");
  const [price2, setPrice2] = useState("");
  const [label, setLabel] = useState("");
  const [editing, setEditing] = useState<string>();
  const [color, setColor] = useState("rgb(41 98 255)");
  const m = useMutation();
  const update = useEffectEvent(onChange);
  useEffect(() => update(local ?? r.data?.drawings ?? []), [local, r.data]);
  const single = type === "hline" || type === "vline";
  const valid =
    Number.isFinite(Date.parse(time1)) &&
    !!price1.trim() &&
    Number.isFinite(Number(price1)) &&
    (single ||
      (Number.isFinite(Date.parse(time2)) &&
        !!price2.trim() &&
        Number.isFinite(Number(price2))));
  return (
    <Glass style={{ padding: 20, gap: 12 }}>
      <Section title="我的云端画线" />
      <ResourceState resource={r} empty={false} message="画线暂无内容" />
      <Copy muted>
        选择 K 线后可填入锚点，也可直接编辑日期与价格。保存后与 Web
        同步；不会自动覆盖云端变化。
      </Copy>
      <Filters
        values={[
          ["trend", "趋势线"],
          ["ray", "射线"],
          ["hline", "水平线"],
          ["vline", "垂直线"],
          ["rect", "矩形"],
          ["fib", "斐波那契"],
          ["fibext", "斐波延伸"],
          ["extended", "延长线"],
          ["measure", "测量"],
        ]}
        value={type}
        onChange={(v) => setType(v as Drawing["type"])}
      />
      <Field
        editable={!m.busy}
        label="锚点 1 日期 / ISO 时间"
        value={time1}
        onChangeText={setTime1}
      />
      <Field
        editable={!m.busy}
        label="锚点 1 价格"
        value={price1}
        onChangeText={setPrice1}
        keyboardType="decimal-pad"
      />
      <Button
        disabled={!bar}
        onPress={() => {
          setTime1(bar!.date);
          setPrice1(String(bar!.close));
        }}
      >
        将选中 K 线设为锚点 1
      </Button>
      {!single && (
        <>
          <Field
            editable={!m.busy}
            label="锚点 2 日期 / ISO 时间"
            value={time2}
            onChangeText={setTime2}
          />
          <Field
            editable={!m.busy}
            label="锚点 2 价格"
            value={price2}
            onChangeText={setPrice2}
            keyboardType="decimal-pad"
          />
          <Button
            disabled={!bar}
            onPress={() => {
              setTime2(bar!.date);
              setPrice2(String(bar!.close));
            }}
          >
            将选中 K 线设为锚点 2
          </Button>
        </>
      )}
      <Field
        editable={!m.busy}
        label="画线标注"
        value={label}
        onChangeText={setLabel}
        maxLength={80}
      />
      <Filters
        values={[
          ["rgb(41 98 255)", "蓝色"],
          ["rgb(245 158 11)", "橙色"],
          ["rgb(168 85 247)", "紫色"],
          ["rgb(var(--foreground))", "前景色"],
        ]}
        value={color}
        onChange={setColor}
      />
      <Button
        disabled={!valid || rows.length >= 300}
        onPress={() => {
          const points = [
            { time: Date.parse(time1) / 1000, price: Number(price1) },
            ...(!single
              ? [{ time: Date.parse(time2) / 1000, price: Number(price2) }]
              : []),
          ];
          setLocal([
            ...rows.filter((d) => d.id !== editing),
            {
              id: editing || `mobile-${Date.now()}`,
              type,
              points,
              color,
              label,
            },
          ]);
          setEditing(undefined);
        }}
      >
        {" "}
        {editing ? "更新本地画线" : "添加本地画线"}
      </Button>
      {rows.map((d) => (
        <Glass key={d.id} style={{ padding: 12, gap: 8 }}>
          <Copy>
            {d.type} · {d.label || d.id} ·{" "}
            {d.points.map((p) => p.price).join(" → ")}
          </Copy>
          <Button
            onPress={() => {
              setEditing(d.id);
              setType(d.type);
              setTime1(new Date(d.points[0].time * 1000).toISOString());
              setPrice1(String(d.points[0].price));
              setTime2(
                d.points[1]
                  ? new Date(d.points[1].time * 1000).toISOString()
                  : "",
              );
              setPrice2(d.points[1] ? String(d.points[1].price) : "");
              setLabel(d.label || "");
              setColor(d.color);
            }}
          >
            编辑
          </Button>
          <Button onPress={() => setLocal(rows.filter((x) => x.id !== d.id))}>
            从本地移除
          </Button>
        </Glass>
      ))}
      <Button
        disabled={!local || m.busy || !r.data}
        onPress={() =>
          void m.run(async (signal) => {
            const latest = await apiRequest<{
              drawings: Drawing[];
              updated_at?: string;
            }>(`/chart-drawings/${symbol}`, {
              signal,
              authenticated: true,
              expectedUser: user,
            });
            if (latest.updated_at !== r.data?.updated_at)
              throw new Error("云端画线已变化，未覆盖。请先核对并重新读取。");
            await apiRequest<{ drawings: Drawing[] }>(
              `/chart-drawings/${symbol}`,
              {
                method: "PUT",
                body: { drawings: rows },
                signal,
                authenticated: true,
                expectedUser: user,
              },
            );
            // Keep edits made while the save was in flight; the next explicit save syncs them.
            r.refresh();
          })
        }
      >
        保存全部画线至云端
      </Button>
      <ConfirmAction
        label="放弃本地修改并重新读取"
        description="尚未保存的画线修改将丢失。"
        onConfirm={() => {
          setLocal(undefined);
          r.refresh();
        }}
      />
      <MutationStatus {...m} />
    </Glass>
  );
}
