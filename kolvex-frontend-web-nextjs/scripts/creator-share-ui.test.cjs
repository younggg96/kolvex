const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { File } = require('node:buffer');
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise((r) => resolve = r); return { promise, resolve }; };
function fixture() {
  let cursor = 0;
  const slots = [], pending = [], calls = [], revoked = [];
  const request = deferred();
  const doc = { creator: '真实博主', source: 'https://www.youtube.com/watch?v=abcdefghijk', pages: [[{ ticker: 'NVDA', sentiment: 'bullish', lines: ['增长'] }]] };
  let shared = 0;
  let cancel = false;
  const react = {
    useId: () => 'transcript',
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (next) => slots[i] = typeof next === 'function' ? next(slots[i]) : next]; },
    useEffect(effect, deps) {
      const i = cursor++;
      const previous = slots[i];
      if (!previous || deps.some((v, index) => !Object.is(v, previous.deps[index]))) {
        pending.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; });
      }
    },
  };
  const modules = {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'lucide-react': {}, '@/components/ui/button': { Button: 'button' },
    '@/components/ui/dialog': { Dialog: 'dialog', DialogContent: 'content', DialogDescription: 'description', DialogHeader: 'header', DialogTitle: 'title', DialogTrigger: 'trigger' },
    '@/lib/i18n': { useTranslation: () => ({ locale: 'zh' }) },
    '@/components/decision/shared': { useCopy: () => (en, zh) => zh },
    '@/lib/youtubeOpinionsApi': { getCreatorLatestVideo: (id, signal) => { calls.push({ id, signal }); return request.promise; } },
    '@/lib/creatorShareImage': { planCreatorShare: () => doc, renderCreatorSharePage: async () => new Blob(['png'], { type: 'image/png' }), creatorShareFilename: () => 'share.png' },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../components/youtube/CreatorOpinionShare.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports: module.exports, require: (name) => { if (!(name in modules)) throw new Error(name); return modules[name]; },
    AbortController, File, Blob, DOMException,
    document: { fonts: { ready: Promise.resolve() }, createElement: () => ({ getContext: () => ({}) }) },
    URL: { createObjectURL: () => 'blob:preview', revokeObjectURL: (url) => revoked.push(url) },
    navigator: { canShare: () => true, share: () => { shared++; return cancel ? Promise.reject(new DOMException('cancelled', 'AbortError')) : Promise.resolve(); } },
  });
  return {
    render() { cursor = 0; return module.exports.default({ creator: { channel_id: 'creator1' } }); },
    effects() { pending.splice(0).forEach((effect) => effect()); },
    request, calls, revoked, doc, get shared() { return shared; }, cancel() { cancel = true; },
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
  h.request.resolve({ creator: {}, video: {}, opinions: [{}] }); await tick();
  assert.equal(nodes(h.render(), (node) => node.type === 'img').length, 0);
});

test('prepared PNG shares directly on click, cancellation is quiet, and close revokes the preview', async () => {
  const h = fixture();
  h.render().props.onOpenChange(true); h.render(); h.effects();
  h.request.resolve({ creator: {}, video: {}, opinions: [{}] }); await tick();
  h.render(); h.effects(); await tick();
  const tree = h.render();
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
