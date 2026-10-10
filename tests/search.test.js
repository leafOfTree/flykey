import assert from "node:assert/strict";
import test from "node:test";
import {
  createDisplayList,
  filterHistory,
  highlightParts,
  normalizeHistoryResults,
  normalizeTabResults,
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

test("ranks history by match quality before recency", () => {
  const history = normalizeHistoryResults([
    { title: "Notes about my svelte app", url: "https://blog.example.com/a", lastVisitTime: 50 },
    { title: "Presvelte tooling", url: "https://example.com/b", lastVisitTime: 40 },
    { title: "Docs", url: "https://svelte.dev/docs", lastVisitTime: 10 },
    { title: "Svelte tutorial", url: "https://example.com/c", lastVisitTime: 20 },
    { title: "Other", url: "https://example.com/d", lastVisitTime: 60 },
  ]);

  assert.deepEqual(filterHistory(history, "svelte").map((item) => item.url), [
    "https://example.com/c",
    "https://svelte.dev/docs",
    "https://blog.example.com/a",
    "https://example.com/b",
  ]);
});

test("orders equally good matches by most recent visit", () => {
  const history = normalizeHistoryResults([
    { title: "Svelte old", url: "https://example.com/old", lastVisitTime: 1 },
    { title: "Svelte new", url: "https://example.com/new", lastVisitTime: 2 },
  ]);

  assert.deepEqual(filterHistory(history, "svelte").map((item) => item.url), [
    "https://example.com/new",
    "https://example.com/old",
  ]);
});

test("matches multiple words across title and URL", () => {
  const history = normalizeHistoryResults([
    { title: "Issues · flykey", url: "https://github.com/leafOfTree/flykey/issues", lastVisitTime: 1 },
    { title: "Flykey mirror", url: "https://gitcode.com/flykey", lastVisitTime: 2 },
  ]);

  assert.deepEqual(filterHistory(history, "github issues").map((item) => item.url), [
    "https://github.com/leafOfTree/flykey/issues",
  ]);
});

test("treats Chinese characters as word starts", () => {
  const history = normalizeHistoryResults([
    { title: "abc笔记", url: "https://example.com/new", lastVisitTime: 2 },
    { title: "我的笔记", url: "https://example.com/old", lastVisitTime: 1 },
    { title: "notebook", url: "https://example.com/other", lastVisitTime: 3 },
  ]);

  assert.deepEqual(filterHistory(history, "笔记").map((item) => item.url), [
    "https://example.com/new",
    "https://example.com/old",
  ]);
});

test("ranks keywords at the start or end of the URL first", () => {
  const history = normalizeHistoryResults([
    { title: "About flykey", url: "https://example.com/about", lastVisitTime: 40 },
    { title: "Repo", url: "https://github.com/leafOfTree/flykey/?tab=readme#top", lastVisitTime: 10 },
    { title: "Site", url: "https://www.flykey.dev/docs", lastVisitTime: 20 },
    { title: "Issues", url: "https://github.com/leafOfTree/flykey/issues", lastVisitTime: 30 },
  ]);

  assert.deepEqual(filterHistory(history, "flykey").map((item) => item.url), [
    "https://www.flykey.dev/docs",
    "https://github.com/leafOfTree/flykey/?tab=readme#top",
    "https://example.com/about",
    "https://github.com/leafOfTree/flykey/issues",
  ]);
});

test("tab search includes internal pages and preserves tabs sharing a URL", () => {
  const tabs = normalizeTabResults([
    { id: 1, title: "Settings", url: "chrome://settings/" },
    { id: 2, title: "Svelte docs", url: "https://svelte.dev/" },
    { id: 3, title: "Svelte docs copy", url: "https://svelte.dev/" },
    { id: -1, title: "Invalid" },
  ]);
  assert.deepEqual(createDisplayList(tabs, "t").map((item) => item.tabId), [1, 2, 3]);
  assert.deepEqual(createDisplayList(tabs, "t svelte").map((item) => item.tabId), [2, 3]);
  assert.deepEqual(createDisplayList(tabs, "t settings").map((item) => item.tabId), [1]);
  assert.deepEqual(createDisplayList(tabs, "t missing"), []);
  assert.deepEqual(highlightParts("Svelte docs", "t svelte")[0], { text: "Svelte", match: true });
});

test("default search preserves original history results even when matching tabs are open", () => {
  const history = normalizeHistoryResults([
    { title: "Example history", url: "https://example.com/" },
    { title: "Other history", url: "https://other.example.com/" },
  ]);
  const results = [
    ...normalizeTabResults([{ id: 4, title: "Example", url: "https://example.com/" }]),
    ...history,
  ];
  for (const query of ["", "example", "example.com", "h example", "l 5173"]) {
    assert.deepEqual(createDisplayList(results, query), createDisplayList(history, query));
  }
  assert.equal(createDisplayList(results, "t example")[0].tabId, 4);
});
