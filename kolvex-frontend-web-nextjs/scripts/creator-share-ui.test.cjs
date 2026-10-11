const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function loadHelper(file) {
  const filename = path.resolve(__dirname, '../lib', file + '.ts');
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports: module.exports, Date, Intl, URL, URLSearchParams,
    require: (name) => loadHelper(path.relative(path.join(__dirname, '../lib'), path.resolve(path.dirname(filename), name))),
  });
  return module.exports;
}
const data = { creator: { channel_id: 'creator1', channel_title: '真实博主' }, video: { video_id: 'abcdefghijk', video_title: '最新视频', opinion_date: '2026-10-08' }, opinions: [{ ticker: 'NVDA', sentiment: 'bullish', summary: '增长' }] };
const { File } = require('node:buffer');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise((r) => resolve = r); return { promise, resolve }; };
function fixture(pageCount = 1) {
  let cursor = 0;
  const slots = [], pending = new Map(), calls = [], revoked = [], payloads = [], copied = [];
  const request = deferred();
  const doc = { creator: '真实博主', source: 'https://www.youtube.com/watch?v=abcdefghijk', pages: Array.from({ length: pageCount }, () => [{ ticker: 'NVDA', sentiment: 'bullish', strength: { label: '看多' }, lines: ['增长'] }]) };
  let shared = 0;
  let cancel = false;
  let fileOnly = false;
  let theme = 'light';
  let generated = 0;
  let urlCount = 0;
  const renders = [], decodes = [];
  const t = (key) => key;
  const react = {
    useId: () => 'transcript',
    useRef: () => ({ current: {} }),
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (next) => slots[i] = typeof next === 'function' ? next(slots[i]) : next]; },
    useEffect(effect, deps) {
      const i = cursor++;
      const previous = slots[i];
      if (!previous || deps.some((v, index) => !Object.is(v, previous.deps[index]))) {
        pending.set(i, () => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; });
      }
    },
  };
  const modules = {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'lucide-react': {}, '@/components/ui/button': { Button: 'button' },
    '@/components/ui/input': { Input: 'input' }, '@/components/ui/textarea': { Textarea: 'textarea' },
    '@/components/ui/tabs': { Tabs: 'tabs', TabsContent: 'tabcontent', TabsList: 'tablist', TabsTrigger: 'tabtrigger' },
    '@/lib/creatorSharing': loadHelper('creatorSharing'),
    '@/components/ui/dialog': { Dialog: 'dialog', DialogContent: 'content', DialogDescription: 'description', DialogHeader: 'header', DialogTitle: 'title', DialogTrigger: 'trigger' },
    '@/lib/i18n': { useTranslation: () => ({ locale: 'zh', t }) },
    'next-themes': { useTheme: () => ({ resolvedTheme: theme }) },
    '@/components/decision/shared': { useCopy: () => (en, zh) => zh },
    '@/lib/youtubeOpinionsApi': { getCreatorLatestVideo: (id, signal) => { calls.push({ id, signal }); return request.promise; } },
    '@/lib/creatorShareImage': { readCreatorShareAppearance: () => ({ mode: theme }), planCreatorShare: (_, locale, ctx, appearance) => ({ ...doc, appearance }), creatorSharePageHeight: () => 800, renderCreatorSharePage: async () => { generated++; if (renders.length) await renders.shift().promise; return new Blob(['png'], { type: 'image/png' }); }, creatorShareFilename: () => 'share.png' },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/youtube/CreatorShare.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports: module.exports, require: (name) => { if (!(name in modules)) throw new Error(name); return modules[name]; },
    AbortController, File, Blob, DOMException,
    Image: class { decode() { return decodes.length ? decodes.shift().promise : Promise.resolve(); } },
    document: { fonts: { ready: Promise.resolve() }, createElement: () => ({ getContext: () => ({}) }) },
    URL: { createObjectURL: () => ++urlCount === 1 ? 'blob:preview' : `blob:preview-${urlCount}`, revokeObjectURL: (url) => revoked.push(url) },
    navigator: { clipboard: { writeText: async (text) => copied.push(text) }, canShare: (payload) => !payload.text || !fileOnly, share: (payload) => { payloads.push(payload); shared++; return cancel ? Promise.reject(new DOMException('cancelled', 'AbortError')) : Promise.resolve(); } },
  });
  return {
    render() { cursor = 0; return module.exports.default({ creator: { channel_id: 'creator1' } }); },
    effects() { const effects = [...pending.values()]; pending.clear(); effects.forEach((effect) => effect()); },
    delayRender() { const wait = deferred(); renders.push(wait); return wait; },
    delayDecode() { const wait = deferred(); decodes.push(wait); return wait; },
    request, calls, revoked, doc, payloads, copied, fileOnly() { fileOnly = true; }, get shared() { return shared; }, get generated() { return generated; }, cancel() { cancel = true; }, theme(mode) { theme = mode; },
  };
}
function nodes(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  const children = tree.props?.children;
  return [...(predicate(tree) ? [tree] : []), ...[children].flat(Infinity).flatMap((node) => nodes(node, predicate))];
}

test('closing a pending share aborts the fetch and cannot reveal late results', async () => {
  const h = fixture();
  h.render().props.onOpenChange(true); h.render(); h.effects();
  h.render().props.onOpenChange(false); h.render(); h.effects();
  assert.equal(h.calls[0].id, 'creator1');
  assert.equal(h.calls[0].signal.aborted, true);
  h.request.resolve(data); await tick();
  assert.equal(nodes(h.render(), (node) => node.type === 'img').length, 0);
});

function imageMode(h) {
  nodes(h.render(), (node) => node.type === 'tabs')[0].props.onValueChange('image');
  h.render(); h.effects();
}

test('prepared PNG shares directly on click, cancellation is quiet, and close revokes the preview', async () => {
  const h = fixture();
  h.render().props.onOpenChange(true); h.render(); h.effects();
  imageMode(h);
  h.request.resolve(data); await tick();
  h.render(); h.effects(); await tick();
  const tree = h.render(); h.effects();
  assert.equal(nodes(tree, (node) => node.type === 'img')[0].props.src, 'blob:preview');
  assert.equal(nodes(tree, (node) => node.type === 'a' && node.props.download)[0].props.download, 'share.png');
  const share = nodes(tree, (node) => node.type === 'button' && node.props.children?.includes?.('分享图片') && node.props.onClick)[0];
  h.cancel(); share.props.onClick();
  assert.equal(h.shared, 1);
  await tick();
  assert.equal(nodes(h.render(), (node) => node.props?.role === 'status').at(-1).props.children, '');
  h.render().props.onOpenChange(false); h.render(); h.effects();
  assert.deepEqual(h.revoked, ['blob:preview']);
});

test('changing website theme invalidates the previous image and regenerates it', async () => {
  const h = fixture();
  h.render().props.onOpenChange(true); h.render(); h.effects();
  imageMode(h);
  h.request.resolve(data); await tick();
  h.render(); h.effects(); await tick();
  assert.equal(nodes(h.render(), (node) => node.type === 'img').length, 1); h.effects();
  h.theme('dark');
  assert.equal(nodes(h.render(), (node) => node.type === 'img').length, 0);
  h.effects(); await tick(); h.render(); h.effects(); await tick();
  assert.equal(nodes(h.render(), (node) => node.type === 'img').length, 1);
  assert.equal(h.generated, 2);
  assert.deepEqual(h.revoked, ['blob:preview']);
});


test('one Share entry defaults to links and social composers without rendering an image', async () => {
  const h = fixture();
  const trigger = nodes(h.render(), (node) => node.type === 'trigger')[0];
  assert.ok(nodes(trigger, (node) => node.type === 'button' && node.props.children.includes('分享')).length);
  h.render().props.onOpenChange(true); h.render(); h.effects();
  h.request.resolve(data); await tick(); h.render(); h.effects(); await tick();
  const tree = h.render();
  assert.equal(h.generated, 0);
  const url = 'https://kolvex.app/share/creators/creator1';
  assert.equal(nodes(tree, (node) => node.type === 'input')[0].props.value, url);
  const copyLink = nodes(tree, (node) => node.type === 'button' && node.props.children?.includes?.('复制链接'))[0];
  await copyLink.props.onClick(); await tick();
  assert.equal(h.copied[0], url);
  const copyText = nodes(tree, (node) => node.type === 'button' && node.props.children?.includes?.('复制文案'))[0];
  await copyText.props.onClick(); await tick();
  assert.ok(h.copied[1].includes('NVDA · 看多\n增长'));
  for (const anchor of nodes(tree, (node) => node.type === 'a' && node.props.target === '_blank')) {
    assert.equal(anchor.props.rel, 'noopener noreferrer');
    assert.ok(anchor.props.href.startsWith('https://'));
  }
  const share = nodes(tree, (node) => node.type === 'button' && node.props.children?.includes?.('更多应用'))[0];
  share.props.onClick();
  assert.equal(h.shared, 1);
  assert.equal(h.payloads[0].url, url);
  assert.equal(h.payloads[0].files, undefined);
});

test('image sharing falls back to files only when an app rejects combined text and file payloads', async () => {
  const h = fixture();
  h.render().props.onOpenChange(true); h.render(); h.effects(); imageMode(h);
  h.request.resolve(data); await tick(); h.render(); h.effects(); await tick();
  h.fileOnly();
  const button = nodes(h.render(), (node) => node.type === 'button' && node.props.children?.includes?.('分享图片') && node.props.onClick)[0];
  button.props.onClick();
  assert.equal(h.payloads[0].files[0].name, 'share.png');
  assert.equal(h.payloads[0].text, undefined);
});


const previewImage = (h) => nodes(h.render(), (node) => node.type === 'img')[0];
const nextImage = (h) => nodes(h.render(), (node) => node.props?.['aria-label'] === '下一张图片')[0].props.onClick();
async function openImages(h) {
  h.render().props.onOpenChange(true); h.render(); h.effects(); imageMode(h);
  h.request.resolve(data); await tick(); h.render(); h.effects(); await tick(); h.render(); h.effects();
}

test('switching pages keeps the old image and controls until the new PNG is decoded', async () => {
  const h = fixture(3); await openImages(h);
  const render = h.delayRender(), decode = h.delayDecode();
  nextImage(h); h.render(); h.effects();
  assert.equal(previewImage(h).props.src, 'blob:preview');
  const tree = h.render();
  assert.equal(nodes(tree, (node) => node.type === 'figure')[0].props['aria-busy'], true);
  const download = nodes(tree, (node) => node.type === 'a' && node.props['aria-disabled'] === true)[0];
  assert.ok(download); assert.equal(download.props.href, undefined);
  assert.deepEqual(h.revoked, []);
  render.resolve(); await tick();
  assert.equal(previewImage(h).props.src, 'blob:preview');
  decode.resolve(); await tick(); h.render(); h.effects();
  assert.equal(previewImage(h).props.src, 'blob:preview-2');
  assert.deepEqual(h.revoked, ['blob:preview']);
  assert.match(previewImage(h).props.alt, /第 2/);
});

test('rapid navigation discards stale results and closing releases an undecoded PNG', async () => {
  const h = fixture(3); await openImages(h);
  const slow = h.delayRender(); nextImage(h); h.render(); h.effects(); await tick();
  nextImage(h); h.render(); h.effects(); await tick(); h.render(); h.effects();
  assert.match(previewImage(h).props.alt, /第 3/);
  slow.resolve(); await tick();
  assert.match(previewImage(h).props.alt, /第 3/);
  const decode = h.delayDecode();
  nodes(h.render(), (node) => node.props?.['aria-label'] === '上一张图片')[0].props.onClick();
  h.render(); h.effects(); await tick();
  h.render().props.onOpenChange(false); h.render(); h.effects();
  decode.resolve(); await tick();
  assert.equal(previewImage(h), undefined);
  assert.deepEqual([...h.revoked].sort(), ['blob:preview', 'blob:preview-2', 'blob:preview-3'].sort());
});
