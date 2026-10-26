const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function setup({ reduced = false, pathname = '/research', observerSupported = true } = {}) {
  const listeners = new Map();
  const windowListeners = new Map();
  const preferenceListeners = new Map();
  const animations = [];
  let effect;
  let observer;
  class Item {
    pending = false;
    constructor(top) { this.top = top; }
    getBoundingClientRect() { return { top: this.top, bottom: this.top + 160 }; }
    setAttribute() { this.pending = true; }
    removeAttribute() { this.pending = false; }
    closest() { return this.pending ? this : null; }
    animate(frames, options) {
      const animation = { frames, options, cancelled: false, cancel() { this.cancelled = true; } };
      animations.push(animation);
      return animation;
    }
  }
  const items = [new Item(100), new Item(1200), new Item(1500)];
  const root = {
    querySelectorAll: () => items,
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const preference = {
    matches: reduced,
    addEventListener: (name, fn) => preferenceListeners.set(name, fn),
    removeEventListener: (name) => preferenceListeners.delete(name),
  };
  class Observer {
    observed = new Set();
    disconnected = false;
    constructor(callback) { this.callback = callback; observer = this; }
    observe(item) { this.observed.add(item); }
    unobserve(item) { this.observed.delete(item); }
    disconnect() { this.observed.clear(); this.disconnected = true; }
    enter(item) { this.callback([{ target: item, isIntersecting: true }]); }
  }
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../components/public/ReadingMotion.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module, exports: module.exports, Element: Item, IntersectionObserver: Observer,
    document: { getElementById: () => root },
    window: {
      innerHeight: 800, matchMedia: () => preference,
      ...(observerSupported ? { IntersectionObserver: Observer } : {}),
      addEventListener: (name, fn) => windowListeners.set(name, fn),
      removeEventListener: (name) => windowListeners.delete(name),
    },
    require: (name) => name === 'react'
      ? { useEffect: (fn) => { effect = fn; } }
      : { usePathname: () => pathname, useSearchParams: () => new URLSearchParams() },
  });
  module.exports.ReadingMotion();
  const cleanup = effect();
  return { items, animations, observer, listeners, windowListeners, preferenceListeners, preference, cleanup };
}

test('offscreen rows reveal once when reached, with no looping observer', () => {
  const state = setup();
  assert.equal(state.items[0].pending, false);
  assert.equal(state.items[1].pending, true);
  state.observer.enter(state.items[1]);
  assert.equal(state.items[1].pending, false);
  assert.equal(state.observer.observed.has(state.items[1]), false);
  assert.equal(state.animations.length, 2);
  state.cleanup();
});

test('keyboard focus reveals an offscreen target immediately and cancels entrance motion', () => {
  const state = setup();
  state.listeners.get('focusin')({ target: state.items[2] });
  assert.equal(state.items[2].pending, false);
  assert.equal(state.observer.observed.has(state.items[2]), false);
  assert.ok(state.animations.every((animation) => animation.cancelled));
  state.cleanup();
});

test('reduced motion and browsers without an observer keep all content visible', () => {
  for (const options of [{ reduced: true }, { observerSupported: false }]) {
    const state = setup(options);
    assert.ok(state.items.every((item) => !item.pending));
    assert.equal(state.animations.length, 0);
    state.cleanup();
  }
});

test('changing motion preference or printing reveals every pending row', () => {
  for (const trigger of ['reduce', 'print']) {
    const state = setup();
    if (trigger === 'reduce') {
      state.preference.matches = true;
      state.preferenceListeners.get('change')();
    } else state.windowListeners.get('beforeprint')();
    assert.ok(state.items.every((item) => !item.pending));
    assert.ok(state.animations.every((animation) => animation.cancelled));
    assert.equal(state.observer.disconnected, true);
    state.cleanup();
  }
});

test('route cleanup releases observers and handlers and restores readable content', () => {
  const state = setup();
  state.cleanup();
  assert.ok(state.items.every((item) => !item.pending));
  assert.ok(state.animations.every((animation) => animation.cancelled));
  assert.equal(state.listeners.size + state.windowListeners.size + state.preferenceListeners.size, 0);
  assert.equal(state.observer.disconnected, true);
  assert.equal(setup({ pathname: '/stocks/NVDA' }).animations.length, 0);
});
