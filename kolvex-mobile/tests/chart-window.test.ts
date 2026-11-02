import test from "node:test";
import assert from "node:assert/strict";
import {
  panWindow,
  pinchWindow,
  normalizedWindow,
} from "../src/lib/chartWindow";
test("horizontal pan maps pixels to bar offsets and clamps both data edges", () => {
  const w = { length: 200, count: 60, offset: 0 };
  assert.equal(panWindow(w, 160, 320).offset, 30);
  assert.equal(panWindow(w, -320, 320).offset, 0);
  assert.equal(panWindow(w, 9999, 320).offset, 140);
});
test("pinch preserves the visible center when there is data on both sides", () => {
  const w = { length: 200, count: 60, offset: 30 };
  assert.deepEqual(pinchWindow(w, 2), { length: 200, count: 30, offset: 45 });
  assert.deepEqual(pinchWindow(w, 0.5), { length: 200, count: 120, offset: 0 });
});
test("short histories and extreme pinch ratios cannot produce an invalid window", () => {
  assert.deepEqual(normalizedWindow({ length: 5, count: 60, offset: 50 }), {
    length: 5,
    count: 5,
    offset: 0,
  });
  assert.equal(
    pinchWindow({ length: 500, count: 60, offset: 0 }, 100).count,
    15,
  );
  assert.equal(
    pinchWindow({ length: 500, count: 60, offset: 0 }, 0.01).count,
    240,
  );
});
test("invalid gesture dimensions and ratios do not move the chart", () => {
  const w = { length: 200, count: 60, offset: 20 };
  assert.deepEqual(panWindow(w, 12, 0), w);
  assert.deepEqual(pinchWindow(w, NaN), w);
  assert.deepEqual(pinchWindow(w, 0), w);
});
