// Shared by CandleGraph drawing and touch placement so a touch lands on the drawn price.
export const VIEW_WIDTH = 320;
export const VIEW_HEIGHT = 260;
export const PLOT = { left: 10, width: 300, baseline: 220, height: 200 };
export function toViewBox(
  x: number,
  y: number,
  layoutWidth: number,
  layoutHeight: number,
) {
  // react-native-svg's default preserveAspectRatio: scale to fit, then center.
  const scale = Math.min(layoutWidth / VIEW_WIDTH, layoutHeight / VIEW_HEIGHT);
  return {
    x: (x - (layoutWidth - VIEW_WIDTH * scale) / 2) / scale,
    y: (y - (layoutHeight - VIEW_HEIGHT * scale) / 2) / scale,
  };
}
export function anchorAt(
  point: { x: number; y: number },
  bars: readonly { date: string }[],
  min: number,
  span: number,
) {
  const dx = PLOT.width / bars.length;
  const index = Math.max(
    0,
    Math.min(bars.length - 1, Math.floor((point.x - PLOT.left) / dx)),
  );
  const price = min + ((PLOT.baseline - point.y) / PLOT.height) * span;
  return {
    time: Date.parse(bars[index].date) / 1000,
    price: Number(Math.max(0, price).toFixed(4)),
  };
}
