import assert from "node:assert/strict";
import test from "node:test";
import {
  createDisplayList,
  highlightParts,
  normalizeHistoryResults,
  removeDuplicateUrls,
} from "../frontend/src/command/search.js";

const favicon = (url) => `favicon:${url}`;

test("normalizes safe history results and rejects non-web protocols", () => {
  const results = normalizeHistoryResults([
    { title: "Example", url: "https://example.com/path", lastVisitTime: 10 },
    { title: "", url: "javascript:alert(1)" },
    { url: "data:text/html,test" },
  ]);

  assert.equal(results.length, 1);
  assert.equal(results[0].displayUrl, "example.com/path");
  assert.equal(results[0].favicon, "");
});

test("deduplicates hash variants without mutating the first result", () => {
  const first = { url: "https://example.com/page#one" };
  const results = removeDuplicateUrls([first, { url: "https://example.com/page#two" }]);
  assert.deepEqual(results, [first]);
});

test("adds provider actions and ranks matching history", () => {
  const history = normalizeHistoryResults([
    { title: "Unrelated", url: "https://example.com", lastVisitTime: 20 },
    { title: "Svelte repository", url: "https://github.com/sveltejs/svelte", lastVisitTime: 10 },
  ]);
  const results = createDisplayList(history, "h svelte", favicon);

  assert.equal(results[0].displayUrl, "搜索 GitHub");
  assert.match(results[0].url, /^https:\/\/github\.com\/search/);
  assert.equal(results[1].url, "https://github.com/sveltejs/svelte");
});

test("recognizes URLs while rejecting executable schemes", () => {
  const domain = createDisplayList([], "example.com/docs", favicon);
  const script = createDisplayList([], "javascript:alert(1)", favicon);

  assert.equal(domain[0].displayUrl, "打开网址");
  assert.equal(domain[0].url, "https://example.com/docs");
  assert.equal(script.some((item) => item.displayUrl === "打开网址"), false);
});

test("highlights literal search text without creating HTML", () => {
  const parts = highlightParts("Use [brackets] safely", "[brackets]");
  assert.deepEqual(parts, [
    { text: "Use ", match: false },
    { text: "[brackets]", match: true },
    { text: " safely", match: false },
  ]);
});
