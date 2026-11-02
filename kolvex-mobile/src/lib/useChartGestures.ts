import { useEffect, useMemo } from "react";
import {
  PanResponder,
  type GestureResponderEvent,
  type PanResponderGestureState,
  type LayoutChangeEvent,
} from "react-native";
import {
  panWindow,
  pinchWindow,
  normalizedWindow,
  type ChartWindow,
} from "./chartWindow";
const distance = (event: GestureResponderEvent) => {
  const points = event.nativeEvent.touches;
  if (points.length < 2) return 0;
  return Math.hypot(
    points[0].pageX - points[1].pageX,
    points[0].pageY - points[1].pageY,
  );
};
function createController() {
  let live: {
    value: ChartWindow;
    onChange: (next: ChartWindow) => void;
  } | null = null;
  let width = 320;
  let start = {
    value: normalizedWindow({ length: 0, count: 0, offset: 0 }),
    distance: 0,
    dx: 0,
  };
  const reset = (
    event: GestureResponderEvent,
    gesture: PanResponderGestureState,
  ) => {
    if (!live) return;
    start = {
      value: normalizedWindow(live.value),
      distance: distance(event),
      dx: gesture.dx,
    };
  };
  const wants = (
    event: GestureResponderEvent,
    gesture: PanResponderGestureState,
  ) =>
    event.nativeEvent.touches.length >= 2 ||
    (Math.abs(gesture.dx) > 8 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5);
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: (event) =>
      event.nativeEvent.touches.length >= 2,
    onMoveShouldSetPanResponder: wants,
    onMoveShouldSetPanResponderCapture: wants,
    onPanResponderGrant: reset,
    onPanResponderStart: reset,
    onPanResponderEnd: reset,
    onPanResponderMove: (event, gesture) => {
      if (!live) return;
      const d = distance(event);
      if (d > 0 && start.distance === 0) {
        reset(event, gesture);
        return;
      }
      const next =
        d > 0
          ? pinchWindow(start.value, d / start.distance)
          : panWindow(start.value, gesture.dx - start.dx, width);
      if (next.count === live.value.count && next.offset === live.value.offset)
        return;
      live.value = next;
      live.onChange(next);
    },
    onPanResponderTerminationRequest: () => true,
    onShouldBlockNativeResponder: () => true,
  });
  return {
    update(value: ChartWindow, onChange: (next: ChartWindow) => void) {
      live = { value, onChange };
    },
    panHandlers: responder.panHandlers,
    onLayout(event: LayoutChangeEvent) {
      if (event.nativeEvent.layout.width > 0)
        width = event.nativeEvent.layout.width;
    },
  };
}
export function useChartGestures(
  value: ChartWindow,
  onChange: (next: ChartWindow) => void,
) {
  const controller = useMemo(() => createController(), []);
  useEffect(() => {
    controller.update(value, onChange);
  }, [controller, value, onChange]);
  return { panHandlers: controller.panHandlers, onLayout: controller.onLayout };
}
