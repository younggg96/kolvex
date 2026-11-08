/**
 * Site-wide motion: one critically damped spring (damping ratio 1), gestures that keep their
 * release velocity, and rubber bands at boundaries. See lib/motion/spring.ts.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function load(file, extra = {}) {
  const module = { exports: {} };
  const output = ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, Math, performance, ...extra });
  return module.exports;
}

const spring = load("lib/motion/spring.ts");

test("released from rest, the spring rises monotonically from 0 to 1 and never overshoots", () => {
  let previous = -1;
  for (let i = 0; i <= 1000; i++) {
    const y = spring.springProgress(i / 1000);
    assert.ok(y >= previous - 1e-12, `not monotonic at ${i}`);
    assert.ok(y <= 1 + 1e-12, `overshoots at ${i}`);
    previous = y;
  }
  assert.equal(spring.springProgress(0), 0);
  assert.ok(1 - spring.springProgress(1) < 0.0011, "settles within 0.1%");
});

test("the closed form solves x'' + 2ζω x' + ω²(x - target) = 0 with ζ = 1", () => {
  const omega = spring.omegaFromResponse(0.2);
  const h = 1e-4;
  for (const [from, to, v] of [[0, 100, 0], [40, 0, -900], [10, 10, 300]]) {
    for (const t of [0.01, 0.05, 0.1, 0.2]) {
      const x = (s) => spring.criticallyDamped(from, to, v, omega, s).value;
      const first = (x(t + h) - x(t - h)) / (2 * h);
      const second = (x(t + h) - 2 * x(t) + x(t - h)) / (h * h);
      const residual = second + 2 * 1 * omega * first + omega * omega * (x(t) - to);
      const scale = omega * omega * Math.max(Math.abs(from - to), Math.abs(v) / omega, 1);
      assert.ok(Math.abs(residual) < 1e-5 * scale, `residual ${residual} vs scale ${scale}`);
      // The reported velocity is the derivative of the reported position.
      assert.ok(Math.abs(spring.criticallyDamped(from, to, v, omega, t).velocity - first) < 1e-3 * (1 + Math.abs(first)));
    }
    const start = spring.criticallyDamped(from, to, v, omega, 0);
    assert.equal(start.value, from);
    assert.equal(start.velocity, v, "starts at the gesture's velocity");
    assert.ok(Math.abs(spring.criticallyDamped(from, to, v, omega, 3).value - to) < 1e-6, "comes to rest at the target");
  }
});

test("CSS linear() curve and durations in globals.css come from the engine", () => {
  const css = read("app/globals.css");
  const declared = css.match(/--spring:\s*(linear\([^;]+\));/);
  assert.ok(declared, "--spring is declared");
  assert.equal(declared[1], spring.SPRING_EASING);
  for (const [name, response] of Object.entries(spring.SPRING_RESPONSE)) {
    const value = css.match(new RegExp(`--spring-${name}:\\s*(\\d+)ms;`));
    assert.ok(value, `--spring-${name} is declared`);
    assert.equal(Number(value[1]), spring.springDurationMs(response), `--spring-${name}`);
  }
  assert.match(spring.SPRING_EASING, /^linear\(0, .*, 1\)$/);
});

test("rubber band: no stretch at the edge, monotonic resistance, never past one dimension", () => {
  assert.equal(spring.rubberBand(0, 300), 0);
  let previous = 0;
  for (let d = 1; d <= 5000; d += 7) {
    const stretch = spring.rubberBand(d, 300);
    assert.ok(stretch > previous && stretch < d && stretch < 300);
    assert.equal(spring.rubberBand(-d, 300), -stretch, "symmetric");
    previous = stretch;
  }
  // Near the edge it moves at the coefficient's fraction of the finger.
  assert.ok(Math.abs(spring.rubberBand(1, 1e6) - 0.55) < 1e-3);
  assert.equal(spring.rubberBandClamp(50, 0, 100, 300), 50);
  assert.ok(spring.rubberBandClamp(130, 0, 100, 300) > 100 && spring.rubberBandClamp(130, 0, 100, 300) < 130);
  assert.ok(spring.rubberBandClamp(-30, 0, 100, 300) < 0 && spring.rubberBandClamp(-30, 0, 100, 300) > -30);
});

test("release projection follows the flick's direction and grows with its speed", () => {
  assert.equal(spring.projectRelease(10, 0), 10);
  assert.ok(spring.projectRelease(0, 1000) > spring.projectRelease(0, 500));
  assert.ok(spring.projectRelease(0, -800) < 0);
});

test("velocity tracker reads a steady drag and reports 0 after a pause", () => {
  const tracker = new spring.VelocityTracker();
  for (let t = 0; t <= 80; t += 8) tracker.add(2 * t, 1000 + t); // 2 px per ms
  assert.ok(Math.abs(tracker.velocity(1080) - 2000) < 1e-6);
  assert.equal(tracker.velocity(1300), 0, "a finger that stopped has no release speed");
  tracker.reset();
  assert.equal(tracker.velocity(1300), 0);
});

test("motion springs are critically damped", () => {
  const options = spring.motionSpring(0.3);
  assert.equal(options.mass, 1);
  assert.ok(Math.abs(options.damping / (2 * Math.sqrt(options.stiffness * options.mass)) - 1) < 1e-12);
});

test("graph pan bounds keep clampGraphView's behaviour", () => {
  const graph = load("lib/chart/graph.ts");
  const bounds = graph.graphPanBounds(50, 200);
  assert.equal(bounds.min, -5);
  assert.equal(bounds.max, 185);
  assert.equal(graph.clampGraphView({ start: -40, end: 10 }, 200).start, -5);
  assert.equal(graph.clampGraphView({ start: 400, end: 450 }, 200).start, 185);
  assert.equal(graph.clampGraphView({ start: 20, end: 70 }, 200).start, 20);
});

/** The real engine on a simulated 60 fps clock. */
function simulated(extra = {}) {
  let now = 1000, nextId = 1;
  const queue = new Map();
  const engine = load("lib/motion/spring.ts", {
    performance: { now: () => now },
    requestAnimationFrame: (cb) => { queue.set(nextId, cb); return nextId++; },
    cancelAnimationFrame: (id) => queue.delete(id),
    ...extra,
  });
  const run = (ms = 3000) => {
    for (const end = now + ms; now < end && queue.size;) {
      now += 1000 / 60;
      const callbacks = [...queue.values()];
      queue.clear();
      callbacks.forEach((cb) => cb(now));
    }
  };
  return { engine, run, pending: () => queue.size };
}

test("a release starts at the hand's speed and comes to rest exactly on target", () => {
  const { engine, run } = simulated();
  const frames = [];
  let completed = 0;
  engine.animateSpring({ from: 0, to: 100, velocity: 2000, response: 0.2, onUpdate: (v, speed) => frames.push({ v, speed }), onComplete: () => completed++ });
  run();
  // First frame (1/60 s in) has already moved about velocity × dt, not from rest.
  assert.ok(frames[0].v > 2000 / 60 * 0.8, `first step ${frames[0].v}`);
  assert.equal(frames.at(-1).v, 100);
  assert.equal(frames.at(-1).speed, 0);
  assert.equal(completed, 1);
});

test("from rest it never overshoots; stop() freezes it", () => {
  const rest = simulated();
  const values = [];
  rest.engine.animateSpring({ from: 0, to: 50, onUpdate: (v) => values.push(v) });
  rest.run();
  assert.ok(Math.max(...values) <= 50);
  const stopped = simulated();
  let updates = 0;
  const animation = stopped.engine.animateSpring({ from: 0, to: 50, onUpdate: () => updates++ });
  stopped.run(50);
  const seen = updates;
  animation.stop();
  stopped.run(500);
  assert.equal(updates, seen);
  assert.equal(stopped.pending(), 0);
});

test("reduced motion jumps straight to the target", () => {
  const { engine, pending } = simulated({ window: { matchMedia: () => ({ matches: true }) } });
  const values = [];
  engine.animateSpring({ from: 0, to: 50, velocity: 900, onUpdate: (v) => values.push(v) });
  assert.deepEqual(values, [50]);
  assert.equal(pending(), 0);
});

test("a flick into an edge overshoots softly, then springs back onto the edge", () => {
  const { engine, run } = simulated();
  const min = 0, max = 100, span = 60;
  const from = 8, velocity = -600; // fast toward the left edge
  const to = Math.min(Math.max(engine.projectRelease(from, velocity), min), max);
  assert.equal(to, min, "the projected rest point is clamped to the edge");
  const raw = [], shown = [];
  engine.animateSpring({
    from, to, velocity, response: 0.3, precision: 0.001,
    onUpdate: (value) => { raw.push(value); shown.push(engine.rubberBandClamp(value, min, max, span)); },
  });
  run();
  const deepest = Math.min(...raw), deepestShown = Math.min(...shown);
  assert.ok(deepest < min, "momentum carries it past the edge");
  assert.ok(deepestShown > deepest && deepestShown < min, "the overshoot is compressed by the rubber band");
  assert.equal(shown.at(-1), min, "it returns exactly to the edge");
  const turn = shown.indexOf(deepestShown);
  for (let i = turn + 1; i < shown.length; i++) assert.ok(shown[i] >= shown[i - 1] - 1e-9, "one smooth return with no second bounce");
});

test("no hand-written easing curves outside the spring", () => {
  // Infinite ambient loops (float, pulse, gradients, spinners, marquee) have no target to settle
  // on, so they keep their own timing; every transition to a target uses the spring.
  const offenders = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (/\.(tsx?|css)$/.test(entry.name) && rel !== path.join("lib", "motion", "spring.ts")) {
        read(rel).split("\n").forEach((line, index) => {
          if (/cubic-bezier\(/.test(line) && !/infinite/.test(line)) offenders.push(`${rel}:${index + 1}`);
          if (/\bease-linear\b/.test(line)) offenders.push(`${rel}:${index + 1} ease-linear`);
          if (/useSpring\([^)]*damping:/.test(line)) offenders.push(`${rel}:${index + 1} under-damped motion spring`);
          if (rel.endsWith(".css")) {
            const decl = line.match(/\b(?:transition|animation)\s*:\s*([^;{]+)/);
            const value = decl && decl[1].trim();
            if (value && value !== "none" && !/!important/.test(line) && !/var\(--|linear|steps?\(|step-end|infinite/.test(value))
              offenders.push(`${rel}:${index + 1} transition without the spring`);
            if (/\b\d+m?s ease(-in|-out|-in-out)?\b(?! infinite)/.test(line) && !/infinite/.test(line))
              offenders.push(`${rel}:${index + 1} browser ease`);
          }
        });
      }
    }
  };
  ["app", "components", "lib"].forEach(walk);
  assert.ok(!/cubic-bezier\(/.test(read("tailwind.config.ts")), "tailwind.config.ts uses the spring");
  assert.deepEqual(offenders, []);
});
