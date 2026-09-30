import { MessageType, messageTypes } from "./messages.js";

const HISTORY_LOOKBACK_MS = 1000 * 60 * 60 * 24 * 365 * 2;
const MAX_HISTORY_RESULTS = 10_000;
const ACTION_TITLE = "Flykey";
const DISABLED_ACTION_TITLE = "Flykey — 当前网站已停用";

function assertInternalMessage(message, sender) {
  if (sender.id !== chrome.runtime.id) {
    throw new Error("不接受来自其他扩展的消息。");
  }

  if (!message || typeof message !== "object" || !messageTypes.has(message.type)) {
    throw new Error("无法识别的 Flykey 消息。");
  }
}

function getSourceTab(sender) {
  if (sender.tab?.id === undefined || sender.tab.windowId === undefined) {
    throw new Error("此命令必须从浏览器标签页发出。");
  }
  return sender.tab;
}

function normalizeWebUrl(value) {
  if (typeof value !== "string") {
    throw new Error("需要提供网址。");
  }

  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("只能打开 HTTP 或 HTTPS 网址。");
  }
  return url.href;
}

function createTabNextToSource(sender, url) {
  const sourceTab = getSourceTab(sender);
  const options = {
    windowId: sourceTab.windowId,
    index: sourceTab.index + 1,
  };
  if (url) options.url = normalizeWebUrl(url);
  return chrome.tabs.create(options);
}

async function updateActionState(tabId, enabled) {
  const updates = [
    chrome.action.setBadgeText({ tabId, text: enabled ? "" : "off" }),
    chrome.action.setTitle({ tabId, title: enabled ? ACTION_TITLE : DISABLED_ACTION_TITLE }),
  ];
  if (!enabled) {
    updates.push(chrome.action.setBadgeBackgroundColor({ tabId, color: "#6b7280" }));
  }
  await Promise.all(updates);
}

async function selectAdjacentTab(sender, offset) {
  const sourceTab = getSourceTab(sender);
  const tabs = await chrome.tabs.query({ windowId: sourceTab.windowId });
  const orderedTabs = tabs
    .filter((tab) => tab.id !== undefined)
    .sort((a, b) => a.index - b.index);

  if (orderedTabs.length < 2) return;

  const currentIndex = orderedTabs.findIndex((tab) => tab.id === sourceTab.id);
  if (currentIndex === -1) return;

  const targetIndex = (currentIndex + offset + orderedTabs.length) % orderedTabs.length;
  await chrome.tabs.update(orderedTabs[targetIndex].id, { active: true });
}

async function handleMessage(message, sender) {
  assertInternalMessage(message, sender);

  switch (message.type) {
    case MessageType.SEARCH_HISTORY:
      return chrome.history.search({
        text: "",
        maxResults: MAX_HISTORY_RESULTS,
        startTime: Date.now() - HISTORY_LOOKBACK_MS,
      });

    case MessageType.CLOSE_TAB: {
      const tab = getSourceTab(sender);
      await chrome.tabs.remove(tab.id);
      return null;
    }

    case MessageType.PREVIOUS_TAB:
      await selectAdjacentTab(sender, -1);
      return null;

    case MessageType.NEXT_TAB:
      await selectAdjacentTab(sender, 1);
      return null;

    case MessageType.ADD_BOOKMARK: {
      const url = normalizeWebUrl(message.payload?.url);
      const title = String(message.payload?.title || url).slice(0, 500);
      return chrome.bookmarks.create({ title, url });
    }

    case MessageType.NEW_TAB: {
      const url = message.payload?.url;
      return createTabNextToSource(sender, url);
    }

    case MessageType.OPEN_HELP:
      return chrome.tabs.create({ url: chrome.runtime.getURL("help/index.html") });

    case MessageType.UPDATE_ACTION_STATE: {
      const tab = getSourceTab(sender);
      const enabled = message.payload?.enabled;
      if (typeof enabled !== "boolean") throw new Error("扩展状态必须是布尔值。");
      await updateActionState(tab.id, enabled);
      return null;
    }

    case MessageType.CLOSE_OTHER_TABS: {
      const sourceTab = getSourceTab(sender);
      const tabs = await chrome.tabs.query({ windowId: sourceTab.windowId });
      const tabIds = tabs
        .filter((tab) => tab.id !== sourceTab.id && !tab.pinned && tab.id !== undefined)
        .map((tab) => tab.id);

      if (tabIds.length) await chrome.tabs.remove(tabIds);
      return { closedCount: tabIds.length };
    }

    case MessageType.REOPEN_TAB:
      return chrome.sessions.restore();

    case MessageType.RELOAD_EXTENSION:
      setTimeout(() => chrome.runtime.reload(), 0);
      return null;

    default:
      throw new Error("不支持的 Flykey 消息。");
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => {
      console.error("Flykey 命令执行失败", error);
      sendResponse({ ok: false, error: error?.message || "命令执行失败。" });
    });

  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  void updateActionState(tabId, true).catch(() => {});
});
