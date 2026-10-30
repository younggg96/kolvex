const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(`${__dirname}/extract-posts.js`, 'utf8');

function article(options = {}) {
  const own = { innerText: '$TSLA original', closest: () => null };
  const quote = { innerText: 'Quoted source text', closest: () => ({}) };
  const values = { author: 'TestUser', id: '2115976928918139192', label: '2 replies, 1,234 likes, 0 views', social: '', ...options };
  return {
    querySelector(selector) {
      if (selector === 'time') return { closest: () => ({ getAttribute: () => `/${values.author}/status/${values.id}` }), getAttribute: () => '2026-10-29T12:00:00Z' };
      if (selector.includes('socialContext')) return { textContent: values.social };
      if (selector.includes('tweet-text-show-more-link')) return values.truncated ? {} : null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector.includes('tweetText')) return values.quoteOnly ? [quote] : [own, quote];
      if (selector.includes('role="group"')) return [{ getAttribute: () => values.label }];
      if (selector === 'a[href]') return [{ getAttribute: () => `/${values.author}/status/${values.id}/photo/1` }, { getAttribute: () => '/malicious/path' }];
      return [];
    },
  };
}
function extract(articles) {
  const context = { document: { querySelectorAll: () => articles } };
  return JSON.parse(JSON.stringify(vm.runInNewContext(`(${source})("testuser")`, context)));
}
test('preserves string IDs, own text, quote attribution and exact or missing counts', () => {
  const p = extract([article()]).posts[0];
  assert.equal(p.id, '2115976928918139192');
  assert.equal(p.text, '$TSLA original');
  assert.deepEqual(p.quoted_texts, ['Quoted source text']);
  assert.deepEqual(p.metrics, { replies: 2, reposts: null, likes: 1234, bookmarks: null, views: 0 });
  assert.equal(p.media_links.length, 1);
});
test('does not attribute other authors or reposts to target', () => {
  assert.equal(extract([article({ author: 'Other' }), article({ social: 'TestUser reposted' })]).posts.length, 0);
});
test('quote-only text is rejected instead of assigned to the author', () => {
  const result = extract([article({ quoteOnly: true })]);
  assert.equal(result.posts.length, 0);
  assert.equal(result.rejected.length, 1);
});
test('detects pinned and incomplete text; abbreviated counts stay unknown', () => {
  const p = extract([article({ social: 'Pinned', truncated: true, label: '1.2K likes, 2 views' })]).posts[0];
  assert.equal(p.pinned, true); assert.equal(p.truncated, true);
  assert.equal(p.metrics.likes, null); assert.equal(p.metrics.views, 2);
});
