import assert from "node:assert/strict";
import test from "node:test";
import { changeColor, treemap } from "../src/lib/treemap";

test("treemap fills the rectangle with areas proportional to value", () => {
  const rect = { x: 0, y: 0, w: 300, h: 200 };
  const tiles = treemap(
    [
      { key: "a", value: 6 },
      { key: "b", value: 6 },
      { key: "c", value: 4 },
      { key: "d", value: 3 },
      { key: "e", value: 2 },
      { key: "f", value: 2 },
      { key: "g", value: 1 },
    ],
    rect,
  );
  assert.equal(tiles.length, 7);
  const area = tiles.reduce((sum, tile) => sum + tile.w * tile.h, 0);
  assert.ok(Math.abs(area - 300 * 200) < 1e-6);
  const a = tiles.find((tile) => tile.key === "a")!;
  const g = tiles.find((tile) => tile.key === "g")!;
  assert.ok(Math.abs((a.w * a.h) / (g.w * g.h) - 6) < 1e-6);
  for (const tile of tiles) {
    assert.ok(tile.x >= -1e-6 && tile.y >= -1e-6);
    assert.ok(tile.x + tile.w <= 300 + 1e-6 && tile.y + tile.h <= 200 + 1e-6);
  }
});

test("treemap drops empty values and handles no space", () => {
  assert.deepEqual(
    treemap([{ value: 0 }, { value: NaN }], { x: 0, y: 0, w: 10, h: 10 }),
    [],
  );
  assert.deepEqual(treemap([{ value: 1 }], { x: 0, y: 0, w: 0, h: 10 }), []);
});

test("change colour is neutral at zero and saturates at three percent", () => {
  assert.equal(changeColor(0), "rgb(74,78,85)");
  assert.equal(changeColor(5), "rgb(22,163,74)");
  assert.equal(changeColor(-3), "rgb(220,38,38)");
  assert.equal(changeColor(null), "#4A4E55");
});
