const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

function load(file, overrides = {}) {
  const module = { exports: {} };
  const modules = {
    react: { ...React, useLayoutEffect() {} },
    "@/lib/utils": { cn: require("clsx") },
    ...overrides,
  };
  vm.runInNewContext(ts.transpileModule(
    fs.readFileSync(path.join(__dirname, "../components/ui", file), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
  ).outputText, {
    module, exports: module.exports,
    require: name => Object.hasOwn(modules, name) ? modules[name] : require(name),
    ...overrides.globals,
  });
  return module.exports;
}
const h = React.createElement;
const options = [{ value: "first", label: "概览" }, { value: "second", label: "财务" }];

test("all pill lists keep selected text paired with a fill before hydration", () => {
  const { Tabs, TabsList, TabsTrigger } = load("tabs.tsx");
  for (const variant of ["pill", "pill-solid", "auth"]) {
    const html = renderToStaticMarkup(h(Tabs, { defaultValue: "first" },
      h(TabsList, { variant }, options.map(item => h(TabsTrigger, { key: item.value, value: item.value }, item.label))),
    ));
    const active = html.match(/<button[^>]*data-state="active"[^>]*>/)[0];
    assert.ok(active.includes("data-[state=active]:bg-foreground/[0.14]"), variant);
    assert.ok(active.includes("data-[state=active]:text-foreground"), variant);
    assert.ok(html.includes("glass-track"), variant);
    assert.ok(html.includes("glass-thumb"), variant);
    assert.ok(html.includes('data-slot="tabs-pill-indicator"'), variant);
  }
});

test("underline triggers inherit their list variant without inverse text", () => {
  const { Tabs, TabsList, TabsTrigger } = load("tabs.tsx");
  const html = renderToStaticMarkup(h(Tabs, { defaultValue: "first" },
    h(TabsList, { variant: "default" }, h(TabsTrigger, { value: "first" }, "概览")),
  ));
  assert.ok(html.includes("data-[state=active]:text-foreground"));
  assert.ok(!html.includes("data-[state=active]:text-background"));
  assert.ok(!html.includes('data-slot="tabs-pill-indicator"'));
});

test("segmented and legacy switch controls have readable initial selections", () => {
  const { SegmentedControl } = load("segmented-control.tsx");
  const { SwitchTab } = load("switch-tab.tsx");
  const controls = [
    ...["single", "tabs", "radio", "nav"].map(semantics => h(SegmentedControl, {
      options, semantics, label: "选项", value: "first", onChange() {},
    })),
    ...["pills", "tabs"].map(variant => h(SwitchTab, {
      options, variant, value: "first", onValueChange() {},
    })),
  ];
  for (const control of controls) {
    const html = renderToStaticMarkup(control);
    const active = html.match(/<button[^>]*aria-(?:pressed="true"|selected="true"|checked="true"|current="page")[^>]*>/)[0];
    const classes = active.match(/class="([^"]*)"/)[1].split(" ");
    assert.ok(classes.includes("text-foreground"));
    assert.ok(classes.includes("bg-foreground/[0.14]"));
    assert.ok(classes.includes("focus-visible:bg-foreground/[0.14]"));
  }
});

test("hidden pill lists fall back until measurable and ignore indicator mutations", () => {
  const effects = [], observers = [];
  const fakeReact = {
    forwardRef: render => props => render(props, null),
    createContext: value => ({ Provider: "provider", value }),
    useContext: context => context.value,
    useRef: value => ({ current: value }),
    useCallback: fn => fn,
    useState: value => [value, () => {}],
    useEffect() {},
    useLayoutEffect: fn => effects.push(fn),
  };
  class Observer {
    constructor(callback) { observers.push(callback); }
    observe() {}
    disconnect() {}
  }
  const { TabsList } = load("tabs.tsx", {
    react: fakeReact,
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "@radix-ui/react-tabs": { Root: "root", List: "list", Trigger: "trigger", Content: "content" },
    globals: { ResizeObserver: Observer, MutationObserver: Observer, window: { addEventListener() {}, removeEventListener() {} } },
  });
  const listTree = TabsList({ variant: "pill" }).props.children;
  const indicatorNode = listTree.props.children[0];
  const indicatorTree = indicatorNode.type(indicatorNode.props);
  let rect = { left: 0, top: 0, width: 0, height: 0 };
  let present = true;
  const active = { getBoundingClientRect: () => rect };
  const list = {
    dataset: {}, scrollLeft: 0, scrollTop: 0,
    querySelector: () => present ? active : null,
    querySelectorAll: () => [active],
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    addEventListener() {}, removeEventListener() {},
  };
  let writes = 0;
  const indicator = { closest: () => list, style: new Proxy({}, { set(target, key, value) { writes++; target[key] = value; return true; } }) };
  indicatorTree.props.ref.current = indicator;
  const cleanup = effects.pop()();
  assert.equal(list.dataset.pillReady, undefined);
  assert.equal(indicator.style.opacity, "0");
  rect = { left: 4, top: 4, width: 80, height: 40 };
  const mutation = observers.at(-1);
  mutation([{ target: active }]);
  assert.equal(list.dataset.pillReady, "true");
  assert.equal(indicator.style.width, "80px");
  assert.equal(indicator.style.opacity, "1");
  const previousWrites = writes;
  mutation([{ target: indicator }]);
  assert.equal(writes, previousWrites);
  present = false;
  mutation([{ target: list }]);
  assert.equal(list.dataset.pillReady, undefined);
  assert.equal(indicator.style.opacity, "0");
  cleanup();
});
