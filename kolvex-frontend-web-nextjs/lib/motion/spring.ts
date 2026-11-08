/**
 * Kolvex motion: one critically damped spring (damping ratio 1) for every UI animation.
 *
 * - CSS transitions and keyframes use SPRING_EASING, the same spring as a `linear()` curve.
 *   Its shape does not depend on duration: the duration only sets how stiff the spring is.
 * - Gestures hand their release velocity to `animateSpring`, so motion continues at the
 *   speed of the hand instead of restarting from rest.
 * - Past a boundary, a dragged value follows `rubberBand` and springs back on release.
 *
 * A critically damped spring is the fastest spring that never overshoots, so nothing
 * wobbles; the only "bounce" is the deliberate rubber band at an edge.
 */

/** ω·t at which a critically damped spring released from rest is within 0.1% of its target. */
export const SPRING_SETTLE = 9.233;

/** Spring response (seconds per natural period) for the three motion roles. */
export const SPRING_RESPONSE = {
  /** Hover, press, colour and selection feedback (≈147ms in CSS). */
  fast: 0.1,
  /** Movement: thumbs, disclosures, panels, spring-back after a drag (≈294ms). */
  standard: 0.2,
  /** Large surfaces: sheets, dialogs, page entrances (≈441ms). */
  gentle: 0.3,
} as const;

export function omegaFromResponse(response: number) {
  return (2 * Math.PI) / response;
}

/** Duration in ms a CSS transition needs so SPRING_EASING behaves like a spring of this response. */
export function springDurationMs(response: number) {
  return Math.round((SPRING_SETTLE / omegaFromResponse(response)) * 1000);
}

/** Position and velocity of a critically damped spring t seconds after release. */
export function criticallyDamped(from: number, to: number, velocity: number, omega: number, t: number) {
  const d0 = from - to;
  const b = velocity + omega * d0;
  const decay = Math.exp(-omega * t);
  return {
    value: to + (d0 + b * t) * decay,
    velocity: (velocity - omega * b * t) * decay,
  };
}

/** Normalised progress (0→1) of a spring released from rest, over its settle time. */
export function springProgress(s: number) {
  const u = SPRING_SETTLE * Math.min(Math.max(s, 0), 1);
  return 1 - (1 + u) * Math.exp(-u);
}

/**
 * CSS `linear()` easing for the critically damped spring. Samples are denser at the start,
 * where the curve bends most, and the last point is exactly 1 so nothing jumps at the end.
 */
export function springEasingCss(samples = 40) {
  const points: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const s = Math.pow(i / samples, 1.6);
    const y = i === samples ? 1 : springProgress(s);
    points.push(i === 0 || i === samples ? `${+y.toFixed(4)}` : `${+y.toFixed(4)} ${+(s * 100).toFixed(2)}%`);
  }
  return `linear(${points.join(", ")})`;
}

/** The value written into `--spring` in app/globals.css (a test keeps the two identical). */
export const SPRING_EASING = springEasingCss();

/**
 * Rubber band: how far content moves when dragged `overshoot` past an edge of a
 * `dimension`-sized area. Matches the familiar iOS feel: the further you pull, the
 * harder it resists, and it never exceeds `dimension`.
 */
export function rubberBand(overshoot: number, dimension: number, coefficient = 0.55) {
  if (!overshoot || dimension <= 0) return 0;
  const distance = Math.abs(overshoot);
  return Math.sign(overshoot) * (1 - 1 / ((distance * coefficient) / dimension + 1)) * dimension;
}

/** Clamp to [min, max], letting values past either edge stretch with `rubberBand`. */
export function rubberBandClamp(value: number, min: number, max: number, dimension: number, coefficient = 0.55) {
  if (value < min) return min + rubberBand(value - min, dimension, coefficient);
  if (value > max) return max + rubberBand(value - max, dimension, coefficient);
  return value;
}

/**
 * Where a flicked value would come to rest under iOS-style deceleration, used to choose
 * the spring's target from the release velocity (units per second).
 */
export function projectRelease(position: number, velocity: number, decelerationRate = 0.998) {
  return position + ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Tracks pointer samples and reports the release velocity in units per second. */
export class VelocityTracker {
  private samples: { t: number; x: number }[] = [];

  constructor(private windowMs = 100) {}

  reset() {
    this.samples = [];
  }

  add(x: number, t = performance.now()) {
    this.samples.push({ t, x });
    const cutoff = t - this.windowMs;
    while (this.samples.length > 2 && this.samples[0].t < cutoff) this.samples.shift();
  }

  /** Least-squares slope over the recent window; 0 when the pointer has paused. */
  velocity(now = performance.now()) {
    const recent = this.samples.filter((s) => now - s.t <= this.windowMs);
    if (recent.length < 2) return 0;
    const n = recent.length;
    const mt = recent.reduce((a, s) => a + s.t, 0) / n;
    const mx = recent.reduce((a, s) => a + s.x, 0) / n;
    let num = 0;
    let den = 0;
    for (const s of recent) {
      num += (s.t - mt) * (s.x - mx);
      den += (s.t - mt) ** 2;
    }
    return den ? (num / den) * 1000 : 0;
  }
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export interface SpringAnimation {
  stop(): void;
  readonly done: Promise<void>;
}

/**
 * Drive `onUpdate` with a critically damped spring from `from` to `to`, starting at
 * `velocity` (units/second, e.g. a gesture's release speed). Settles when both distance
 * and speed fall below `precision`. Reduced motion jumps straight to the target.
 */
export function animateSpring({
  from,
  to,
  velocity = 0,
  response = SPRING_RESPONSE.standard,
  precision = 0.01,
  onUpdate,
  onComplete,
}: {
  from: number;
  to: number;
  velocity?: number;
  response?: number;
  precision?: number;
  onUpdate: (value: number, velocity: number) => void;
  onComplete?: () => void;
}): SpringAnimation {
  let frame = 0;
  let resolve: () => void = () => {};
  const done = new Promise<void>((r) => (resolve = r));
  const finish = () => {
    onUpdate(to, 0);
    onComplete?.();
    resolve();
  };

  if (prefersReducedMotion() || typeof requestAnimationFrame === "undefined" || (from === to && !velocity)) {
    finish();
    return { stop() {}, done };
  }

  const omega = omegaFromResponse(response);
  const start = performance.now();
  let stopped = false;
  const tick = (now: number) => {
    if (stopped) return;
    const state = criticallyDamped(from, to, velocity, omega, (now - start) / 1000);
    if (Math.abs(state.value - to) < precision && Math.abs(state.velocity) < precision * omega) {
      finish();
      return;
    }
    onUpdate(state.value, state.velocity);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      resolve();
    },
    done,
  };
}

/** Easing function form of the spring, for the `motion` library's `ease` option. */
export const springEase = (t: number) => springProgress(t);

/** The spring for Web Animations API calls; browsers without CSS `linear()` get the closest bezier. */
export function waapiSpringEasing() {
  const supported = typeof CSS !== "undefined" && CSS.supports?.("animation-timing-function", SPRING_EASING);
  return supported ? SPRING_EASING : "cubic-bezier(0.16, 1, 0.3, 1)";
}

/** `motion` spring options for a critically damped spring of this response (no overshoot). */
export function motionSpring(response: number = SPRING_RESPONSE.standard) {
  const stiffness = omegaFromResponse(response) ** 2;
  return { stiffness, damping: 2 * Math.sqrt(stiffness), mass: 1 };
}
