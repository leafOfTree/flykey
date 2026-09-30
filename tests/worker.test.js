import assert from "node:assert/strict";
import test from "node:test";
import { MessageType } from "../common/messages.js";

const calls = [];
let messageListener;
let queriedTabs = [];
let tabUpdatedListener;

globalThis.chrome = {
  runtime: {
    id: "flykey-test-extension",
    getURL(path) {
      return `chrome-extension://flykey-test-extension/${path}`;
    },
    reload() {
      calls.push(["runtime.reload"]);
    },
    onMessage: {
      addListener(listener) {
        messageListener = listener;
      },
    },
  },
  history: {
    async search(options) {
      calls.push(["history.search", options]);
      return [];
    },
  },
  tabs: {
    onUpdated: {
      addListener(listener) {
        tabUpdatedListener = listener;
      },
    },
    async query(options) {
      calls.push(["tabs.query", options]);
      return queriedTabs;
    },
    async update(id, options) {
      calls.push(["tabs.update", id, options]);
    },
    async remove(ids) {
      calls.push(["tabs.remove", ids]);
    },
    async create(options) {
      calls.push(["tabs.create", options]);
      return { id: 99 };
    },
    async sendMessage(id, message) {
      calls.push(["tabs.sendMessage", id, message]);
    },
  },
  action: {
    async setBadgeText(options) {
      calls.push(["action.setBadgeText", options]);
    },
    async setBadgeBackgroundColor(options) {
      calls.push(["action.setBadgeBackgroundColor", options]);
    },
    async setTitle(options) {
      calls.push(["action.setTitle", options]);
    },
  },
  bookmarks: {
    async create(options) {
      calls.push(["bookmarks.create", options]);
      return options;
    },
  },
  sessions: {
    async restore() {
      calls.push(["sessions.restore"]);
      return {};
    },
  },
};

await import("../common/worker.js");

function send(message, tab = { id: 2, windowId: 7, index: 1 }) {
  return new Promise((resolve) => {
    const keepChannelOpen = messageListener(message, { id: chrome.runtime.id, tab }, resolve);
    assert.equal(keepChannelOpen, true);
  });
}

test.beforeEach(() => {
  calls.length = 0;
  queriedTabs = [];
});

test("adjacent tab navigation stays in the sender's window and wraps", async () => {
  queriedTabs = [
    { id: 1, windowId: 7, index: 0 },
    { id: 2, windowId: 7, index: 1 },
    { id: 3, windowId: 7, index: 2 },
  ];

  const response = await send({ type: MessageType.NEXT_TAB }, queriedTabs[2]);
  assert.deepEqual(response, { ok: true, data: null });
  assert.deepEqual(calls, [
    ["tabs.query", { windowId: 7 }],
    ["tabs.update", 1, { active: true }],
  ]);
});

test("close other tabs preserves the source tab and pinned tabs", async () => {
  queriedTabs = [
    { id: 1, windowId: 7, index: 0, pinned: true },
    { id: 2, windowId: 7, index: 1, pinned: false },
    { id: 3, windowId: 7, index: 2, pinned: false },
  ];

  const response = await send({ type: MessageType.CLOSE_OTHER_TABS });
  assert.deepEqual(response, { ok: true, data: { closedCount: 1 } });
  assert.deepEqual(calls.at(-1), ["tabs.remove", [3]]);
});

test("new tabs open immediately after the source tab", async () => {
  const response = await send({ type: MessageType.NEW_TAB });
  assert.deepEqual(response, { ok: true, data: { id: 99 } });
  assert.deepEqual(calls, [["tabs.create", { windowId: 7, index: 2 }]]);
});

test("new URL tabs open immediately after the source tab", async () => {
  const response = await send({
    type: MessageType.NEW_TAB,
    payload: { url: "https://example.com/docs" },
  });
  assert.deepEqual(response, { ok: true, data: { id: 99 } });
  assert.deepEqual(calls, [
    ["tabs.create", { windowId: 7, index: 2, url: "https://example.com/docs" }],
  ]);
});

test("help command opens the bundled help page", async () => {
  const response = await send({ type: MessageType.OPEN_HELP });
  assert.deepEqual(response, { ok: true, data: { id: 99 } });
  assert.deepEqual(calls, [["tabs.create", { url: "chrome-extension://flykey-test-extension/help/index.html" }]]);
});

test("disabled sites are reflected on the toolbar icon for that tab", async () => {
  const response = await send({
    type: MessageType.UPDATE_ACTION_STATE,
    payload: { enabled: false },
  });
  assert.deepEqual(response, { ok: true, data: null });
  assert.deepEqual(calls, [
    ["action.setBadgeText", { tabId: 2, text: "off" }],
    ["action.setTitle", { tabId: 2, title: "Flykey — 当前网站已停用" }],
    ["action.setBadgeBackgroundColor", { tabId: 2, color: "#6b7280" }],
  ]);
});

test("enabled sites clear the toolbar badge", async () => {
  const response = await send({
    type: MessageType.UPDATE_ACTION_STATE,
    payload: { enabled: true },
  });
  assert.deepEqual(response, { ok: true, data: null });
  assert.deepEqual(calls, [
    ["action.setBadgeText", { tabId: 2, text: "" }],
    ["action.setTitle", { tabId: 2, title: "Flykey" }],
  ]);
});

test("navigation clears a stale per-tab disabled badge", async () => {
  tabUpdatedListener(5, { status: "loading" });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, [
    ["action.setBadgeText", { tabId: 5, text: "" }],
    ["action.setTitle", { tabId: 5, title: "Flykey" }],
  ]);
});

test("reload extension acknowledges the command before restarting the runtime", async () => {
  const response = await send({ type: MessageType.RELOAD_EXTENSION });
  assert.deepEqual(response, { ok: true, data: null });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, [["runtime.reload"]]);
});
