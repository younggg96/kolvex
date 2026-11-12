// Squarified treemap (Bruls, Huizing & van Wijk): tiles whose area follows their
// value while staying as close to square as the rectangle allows.
export type Rect = { x: number; y: number; w: number; h: number };

export function treemap<T extends { value: number }>(
  items: readonly T[],
  rect: Rect,
): (T & Rect)[] {
  const valid = items.filter(
    (item) => Number.isFinite(item.value) && item.value > 0,
  );
  const total = valid.reduce((sum, item) => sum + item.value, 0);
  if (!total || rect.w <= 0 || rect.h <= 0) return [];
  const scale = (rect.w * rect.h) / total;
  const nodes = [...valid]
    .sort((a, b) => b.value - a.value)
    .map((item) => ({ item, area: item.value * scale }));
  const out: (T & Rect)[] = [];
  let free = { ...rect };
  let row: typeof nodes = [];
  // The worst aspect ratio in a row laid along a side of this length.
  const worst = (cells: typeof nodes, side: number) => {
    const sum = cells.reduce((total, cell) => total + cell.area, 0);
    const max = Math.max(...cells.map((cell) => cell.area));
    const min = Math.min(...cells.map((cell) => cell.area));
    return Math.max(
      (side * side * max) / (sum * sum),
      (sum * sum) / (side * side * min),
    );
  };
  const place = (cells: typeof nodes) => {
    const sum = cells.reduce((total, cell) => total + cell.area, 0);
    if (free.w >= free.h) {
      // A column down the left of the free space.
      const w = sum / free.h;
      let y = free.y;
      for (const cell of cells) {
        const h = cell.area / w;
        out.push({ ...cell.item, x: free.x, y, w, h });
        y += h;
      }
      free = { x: free.x + w, y: free.y, w: free.w - w, h: free.h };
    } else {
      // A row across the top of the free space.
      const h = sum / free.w;
      let x = free.x;
      for (const cell of cells) {
        const w = cell.area / h;
        out.push({ ...cell.item, x, y: free.y, w, h });
        x += w;
      }
      free = { x: free.x, y: free.y + h, w: free.w, h: free.h - h };
    }
  };
  let index = 0;
  while (index < nodes.length) {
    const side = Math.min(free.w, free.h);
    const next = [...row, nodes[index]];
    if (!row.length || worst(next, side) <= worst(row, side)) {
      row = next;
      index += 1;
    } else {
      place(row);
      row = [];
    }
  }
  if (row.length) place(row);
  return out;
}

/** Heatmap tile colour: neutral grey at 0 %, full green or red at ±3 %. */
export function changeColor(changePercent: number | null | undefined) {
  if (changePercent == null || !Number.isFinite(changePercent))
    return "#4A4E55";
  const strength = Math.min(Math.abs(changePercent) / 3, 1);
  const from = [74, 78, 85];
  const to = changePercent >= 0 ? [22, 163, 74] : [220, 38, 38];
  const mix = from.map((value, index) =>
    Math.round(value + (to[index] - value) * strength),
  );
  return `rgb(${mix.join(",")})`;
}
