/**
 * Stretch pill: the selection pill behind tab, segment and nav switchers.
 *
 * Each edge of the pill rides its own spring. The edge on the side the pill is
 * moving toward is stiff and leads; the far edge is soft and trails, so the
 * pill stretches toward the new option and then pulls its tail in.
 *
 * Unlike the rest of Kolvex motion (critically damped, see ./spring.ts) these
 * springs are slightly underdamped (ζ ≈ 0.8 lead, ≈ 0.73 trail) so the pill
 * lands with a small settle. Under reduced motion both edges switch to
 * critical damping, so nothing overshoots.
 */

/** Spring constants as [stiffness, damping], mass 1. */
export type SpringConstants = readonly [stiffness: number, damping: number];

/** Edge facing the move. */
export const PILL_LEAD: SpringConstants = [620, 40];
/** Edge that lags behind; this is what makes the stretch. */
export const PILL_TRAIL: SpringConstants = [170, 19];

/** Physics substeps per frame and the longest frame we integrate in one go. */
const SUBSTEPS = 4;
const MAX_DT = 1 / 30;
/** Settled when every edge is within this many px of its target and nearly still. */
const REST_PX = 0.05;
const REST_SPEED = 0.5;

interface Edge {
  x: number;
  v: number;
  t: number;
  k: number;
  c: number;
}

const edge = (x: number): Edge => ({ x, v: 0, t: x, k: PILL_LEAD[0], c: PILL_LEAD[1] });

function tune(spring: Edge, [k, c]: SpringConstants, reduced: boolean) {
  spring.k = k;
  spring.c = reduced ? 2 * Math.sqrt(k) : c;
}

/** One semi-implicit Euler step: the same integrator the reference spring uses. */
export function stepEdge(
  spring: { x: number; v: number; t: number; k: number; c: number },
  dt: number,
) {
  const a = -spring.k * (spring.x - spring.t) - spring.c * spring.v;
  spring.v += a * dt;
  spring.x += spring.v * dt;
}

const atRest = (spring: Edge) =>
  Math.abs(spring.x - spring.t) < REST_PX && Math.abs(spring.v) < REST_SPEED;

export interface PillBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface StretchPillOptions {
  /**
   * Centre the pill vertically with CSS (`top: 50%` + `translateY(-50%)`) and
   * only animate its horizontal edges. Single-row controls use this because
   * offsetTop rounds to whole pixels.
   */
  centerY?: boolean;
}

/**
 * Drives one pill element. Call `moveTo` with the selected option's box; the
 * pill animates there unless `snap` is set (first paint, resize, reflow).
 */
export class StretchPill {
  private left = edge(0);
  private right = edge(0);
  private top = edge(0);
  private bottom = edge(0);
  private frame = 0;
  private last = 0;
  private placed = false;

  constructor(
    private readonly el: HTMLElement,
    private readonly options: StretchPillOptions = {},
  ) {}

  get hasPosition() {
    return this.placed;
  }

  moveTo(box: PillBox, snap = false) {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    const nextRight = box.left + box.width;
    const nextBottom = box.top + box.height;

    // A re-measure that lands on the same target (e.g. a ResizeObserver's
    // first callback right after a selection) must not cut the glide short.
    if (
      snap &&
      this.placed &&
      this.left.t === box.left &&
      this.right.t === nextRight &&
      this.top.t === box.top &&
      this.bottom.t === nextBottom
    ) {
      return;
    }

    if (snap || !this.placed || typeof requestAnimationFrame === "undefined") {
      for (const [spring, value] of [
        [this.left, box.left],
        [this.right, nextRight],
        [this.top, box.top],
        [this.bottom, nextBottom],
      ] as const) {
        spring.x = spring.t = value;
        spring.v = 0;
      }
      this.placed = true;
      this.stop();
      this.render();
      return;
    }

    // The edge facing the move leads; compare centres so a pill that only
    // grows or shrinks in place does not pick a side at random.
    const forwardX = box.left + box.width / 2 >= (this.left.t + this.right.t) / 2;
    tune(forwardX ? this.right : this.left, PILL_LEAD, reduced);
    tune(forwardX ? this.left : this.right, PILL_TRAIL, reduced);
    const forwardY = box.top + box.height / 2 >= (this.top.t + this.bottom.t) / 2;
    tune(forwardY ? this.bottom : this.top, PILL_LEAD, reduced);
    tune(forwardY ? this.top : this.bottom, PILL_TRAIL, reduced);

    this.left.t = box.left;
    this.right.t = nextRight;
    this.top.t = box.top;
    this.bottom.t = nextBottom;
    this.start();
  }

  destroy() {
    this.stop();
  }

  private start() {
    if (this.frame) return;
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.tick);
  }

  private stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private tick = (now: number) => {
    // A frame's timestamp can predate the performance.now() taken in start().
    const dt = Math.min(Math.max(0, (now - this.last) / 1000), MAX_DT);
    this.last = now;
    const springs = [this.left, this.right, this.top, this.bottom];
    for (let i = 0; i < SUBSTEPS; i++)
      for (const spring of springs) stepEdge(spring, dt / SUBSTEPS);

    if (springs.every(atRest)) {
      for (const spring of springs) {
        spring.x = spring.t;
        spring.v = 0;
      }
      this.frame = 0;
      this.render();
      return;
    }
    this.render();
    this.frame = requestAnimationFrame(this.tick);
  };

  private render() {
    const { el, options } = this;
    const width = px(this.right.x - this.left.x);
    el.style.width = width;
    if (options.centerY) {
      el.style.height = px(this.bottom.t - this.top.t);
      el.style.transform = `translate3d(${px(this.left.x, true)}, -50%, 0)`;
    } else {
      el.style.height = px(this.bottom.x - this.top.x);
      el.style.transform = `translate3d(${px(this.left.x, true)}, ${px(this.top.x, true)}, 0)`;
    }
  }
}

/** Pixels rounded to 1/100; sizes never go negative while edges cross mid-flight. */
function px(value: number, signed = false) {
  return `${Math.round((signed ? value : Math.max(0, value)) * 100) / 100}px`;
}
