const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(filename, mocks = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports: module.exports, Date, Intl, URL, URLSearchParams, ...globals,
    require: (name) => name in mocks ? mocks[name] : load(path.resolve(path.dirname(filename), name + '.ts')),
  });
  return module.exports;
}
const sharing = load(path.resolve(__dirname, '../lib/creatorSharing.ts'));
const creator = { channel_id: 'creator1', channel_title: '投资 & TALK 君' };
const summary = '完整中文观点📈'.repeat(300);
const data = {
  creator,
  video: { video_title: '最新一期', video_id: 'abcdefghijk', opinion_date: '2026-10-08', video_published_at: '2026-10-09T02:42:56Z' },
  opinions: [{ ticker: 'MSFT', sentiment: 'bullish', summary }, { ticker: 'TLT', sentiment: 'bearish', key_points: ['保持原始观点'] }],
};

test('public share text retains every opinion and canonical New York date', () => {
  const content = sharing.creatorShareContent(creator, data, 'zh');
  assert.equal(content.url, 'https://kolvex.app/share/creators/creator1');
  assert.ok(content.text.includes(summary));
  assert.ok(content.text.includes('TLT · 看空\n保持原始观点'));
  assert.ok(content.text.includes('2026年10月8日 · 美东日期'));
  assert.ok(Array.from(content.headline).length <= 100);
  assert.equal(sharing.creatorShareUrl('id?token=secret&filter=NVDA'), 'https://kolvex.app/share/creators/id%3Ftoken%3Dsecret%26filter%3DNVDA');
  const fallback = sharing.creatorShareContent(creator, null, 'en');
  assert.ok(fallback.text.endsWith(content.url));
  assert.ok(!fallback.text.includes('undefined'));
});

test('social and email composers preserve URLs and encode text as data', () => {
  const content = sharing.creatorShareContent(creator, data, 'zh');
  const platforms = sharing.creatorSocialLinks(content);
  assert.deepEqual(Array.from(platforms, (item) => item.name), ['X', 'Facebook', 'WhatsApp']);
  const [x, facebook, whatsapp] = platforms.map((item) => new URL(item.href));
  assert.equal(x.pathname, '/intent/tweet');
  assert.equal(x.searchParams.get('url'), content.url);
  assert.equal(x.searchParams.get('text'), content.headline);
  assert.equal(facebook.searchParams.get('u'), content.url);
  assert.equal(whatsapp.searchParams.get('text'), content.headline + '\n' + content.url);
  const email = new URL(sharing.creatorEmailLink(content));
  assert.equal(email.protocol, 'mailto:');
  assert.equal(email.searchParams.get('subject'), content.title);
  assert.equal(email.searchParams.get('body'), content.headline + '\n' + content.url);
});

test('source links reject unsafe or impersonating origins', () => {
  for (const video_url of ['javascript:alert(1)', 'https://youtube.com.evil.example/watch', 'http://www.youtube.com/watch', 'https://user:pass@youtube.com/watch']) {
    assert.equal(sharing.sourceVideoUrl({ video_url, video_id: 'abcdefghijk' }), 'https://www.youtube.com/watch?v=abcdefghijk');
    assert.equal(sharing.sourceVideoUrl({ video_url, video_id: 'invalid' }), '');
  }
  assert.equal(sharing.sourceVideoUrl({ video_url: 'https://youtu.be/abcdefghijk', video_id: 'abcdefghijk' }), 'https://youtu.be/abcdefghijk');
});

test('public page data access rejects malformed IDs and uses no reader credentials', async () => {
  const calls = [];
  const api = load(path.resolve(__dirname, '../app/share/creators/[channelId]/data.ts'), {
    react: { cache: (fn) => fn },
  }, {
    process: { env: { NEXT_PUBLIC_BACKEND_API_URL: 'https://backend.example' } },
    fetch: async (...args) => { calls.push(args); return { ok: true, json: async () => data }; },
  });
  for (const id of ['', '../private', 'id?secret', 'id#fragment', 'x'.repeat(129)]) {
    assert.equal((await api.getPublicCreatorOpinions(id)).creator, null);
  }
  assert.equal(calls.length, 0);
  assert.equal(await api.getPublicCreatorOpinions('creator1'), data);
  assert.equal(calls[0][0], 'https://backend.example/api/v1/youtube-opinions/creators/creator1/latest-video');
  assert.equal(calls[0][1].cache, 'no-store');
  assert.equal(calls[0][1].headers, undefined);
  assert.equal(calls[0][1].credentials, undefined);
});
