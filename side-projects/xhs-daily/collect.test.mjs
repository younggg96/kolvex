import assert from "node:assert/strict";
import test from "node:test";
import { isRecent, parseCommentTotal, parseCount, parseNoteHref, pickDeepReads } from "./collect.mjs";

const ID = "6740a1b2c3d4e5f6a7b8c9d0";

test("note links become canonical /explore/ URLs and keep xsec_token", () => {
  assert.deepEqual(parseNoteHref(`/search_result/${ID}?xsec_token=AB%3D&xsec_source=`), {
    note_id: ID,
    url: `https://www.xiaohongshu.com/explore/${ID}?xsec_token=AB%3D&xsec_source=pc_search`,
    has_token: true,
  });
  assert.deepEqual(parseNoteHref(`/explore/${ID}`), {
    note_id: ID,
    url: `https://www.xiaohongshu.com/explore/${ID}`,
    has_token: false,
  });
  assert.equal(parseNoteHref(`https://evil.example/explore/${ID}`), null);
  assert.equal(parseNoteHref("/user/profile/5f00aa"), null);
  assert.equal(parseNoteHref(null), null);
});

test("counts parse 万 and never invent zero", () => {
  assert.equal(parseCount("1.2万"), 12000);
  assert.equal(parseCount("856"), 856);
  assert.equal(parseCount("赞"), null);
  assert.equal(parseCount(""), null);
  assert.equal(parseCommentTotal("共 1,234 条评论"), 1234);
  assert.equal(parseCommentTotal("评论"), null);
});

test("deep reads prefer recent openable posts, then likes", () => {
  const posts = [
    { note_id: "a", has_token: true, published_raw: "3天前", likes: 900 },
    { note_id: "b", has_token: true, published_raw: "5小时前", likes: 10 },
    { note_id: "c", has_token: false, published_raw: "1小时前", likes: 999 },
    { note_id: "d", has_token: true, published_raw: "20分钟前", likes: 50 },
  ];
  assert.deepEqual(pickDeepReads(posts, 3).map(post => post.note_id), ["d", "b", "a"]);
  assert.equal(isRecent("刚刚"), true);
  assert.equal(isRecent("昨天 23:50"), false);
});
