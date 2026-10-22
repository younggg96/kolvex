const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadHelper(name) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../lib', `${name}.ts`), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports: module.exports, Date, Intl,
    require: (id) => loadHelper(id.replace('./', '')),
  });
  return module.exports;
}
const { videoHistory } = loadHelper('youtubeVideoHistory');
const opinion = { id: 'opinion', video_id: 'tracked0001', video_title: 'Tracked', video_published_at: '2026-10-16T15:00:00Z', opinion_date: '2026-10-16' };
const upload = { video_id: 'newvideo001', title: 'Newest upload', published_at: '2026-10-22T15:00:00Z' };

test('merges newer untracked videos with opinion history without inventing opinions', () => {
  const groups = videoHistory([opinion], [upload]);
  assert.equal(groups[0].videoId, upload.video_id);
  assert.equal(groups[0].video.video_title, upload.title);
  assert.equal(groups[0].video.video_url, 'https://www.youtube.com/watch?v=newvideo001');
  assert.equal(groups[0].opinions.length, 0);
  assert.equal(groups[1].opinions[0], opinion);
  assert.equal(groups.filter((group) => group.opinions.length > 0).length, 1);
});

test('freshly imported videos and repeated coverage entries appear only once', () => {
  const groups = videoHistory([opinion, { ...opinion, id: 'second' }], [upload, upload, { ...upload, video_id: opinion.video_id }]);
  assert.equal(groups.length, 2);
  assert.equal(groups[1].opinions.length, 2);
  assert.equal(groups[1].video.video_title, 'Tracked');
});

test('upload date filters use the same New York day as opinion history', () => {
  const midnight = { ...upload, published_at: '2026-10-22T02:00:00Z' };
  assert.equal(videoHistory([], [midnight], '2026-10-22').length, 0);
  assert.equal(videoHistory([], [midnight], '2026-10-21', '2026-10-21').length, 1);
  assert.equal(videoHistory([], [upload], '', '2026-10-21').length, 0);
  assert.equal(videoHistory([], [{ ...upload, published_at: null }], '2026-10-21').length, 0);
});

test('missing coverage leaves existing grouped opinions intact', () => {
  const groups = videoHistory([opinion], []);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].opinions[0], opinion);
});
