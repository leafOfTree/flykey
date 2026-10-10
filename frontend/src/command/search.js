const SEARCH_PROVIDERS = Object.freeze({
  "c ": {
    domain: "gitcode.com",
    label: "搜索 GitCode",
    url: (query) => `https://gitcode.com/search?q=${encodeURIComponent(query)}&type=repo`,
  },
  "h ": {
    domain: "github.com",
    label: "搜索 GitHub",
    url: (query) => `https://github.com/search?q=${encodeURIComponent(query)}&type=repositories`,
  },
  "s ": {
    domain: "stackoverflow.com",
    label: "搜索 Stack Overflow",
    url: (query) => `https://stackoverflow.com/search?q=${encodeURIComponent(query)}`,
  },
  "w ": {
    domain: "en.wikipedia.org",
    label: "搜索 Wikipedia",
    url: (query) => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`,
  },
  "y ": {
    domain: "youtube.com",
    label: "搜索 YouTube",
    url: (query) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  },
});

const MAX_LIST_ITEMS = 19;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function displayUrl(value) {
  return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
}

export function normalizeHistoryResults(results) {
  return results
    .map((result) => {
      const url = safeUrl(String(result?.url || ""));
      if (!url) return null;

      const title = String(result?.title || "").trim() || displayUrl(url);
      const shownUrl = displayUrl(url);
      return {
        title,
        url,
        displayUrl: shownUrl,
        lowerTitle: title.toLocaleLowerCase(),
        lowerDisplayUrl: shownUrl.toLocaleLowerCase(),
        favicon: "",
        lastVisitTime: Number(result?.lastVisitTime) || 0,
      };
    })
    .filter(Boolean);
}

export function normalizeTabResults(results) {
  return results
    .filter((tab) => Number.isInteger(tab?.id) && tab.id >= 0)
    .map((tab) => {
      const url = String(tab.url || tab.pendingUrl || "");
      const title = String(tab.title || "").trim() || displayUrl(url) || "新标签页";
      const shownUrl = displayUrl(url);
      return {
        tabId: tab.id,
        title,
        url,
        displayUrl: shownUrl,
        lowerTitle: title.toLocaleLowerCase(),
        lowerDisplayUrl: shownUrl.toLocaleLowerCase(),
        favicon: "",
        lastVisitTime: Number(tab.lastAccessed) || 0,
      };
    });
}

export function removeDuplicateUrls(results) {
  const seen = new Set();
  return results.filter((result) => {
    const key = result.url.replace(/#.*/, "");
    if (result.tabId !== undefined) {
      seen.add(key);
      return true;
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 匹配档位：数字越小越相关，同一档位内按最近访问时间排序。
const MatchTier = Object.freeze({
  PREFIX: 0,
  WORD_START: 1,
  TITLE: 2,
  URL: 3,
  ALL_WORD_STARTS: 4,
  ALL_WORDS: 5,
  NONE: -1,
});

// 汉字之间没有空格分词，每个字都视为词首。
function isWordChar(char) {
  return /[\p{L}\p{N}]/u.test(char) && !/\p{Script=Han}/u.test(char);
}

function includesAtWordStart(text, word) {
  let index = text.indexOf(word);
  while (index !== -1) {
    if (index === 0 || !isWordChar(text[index - 1]) || !isWordChar(text[index])) return true;
    index = text.indexOf(word, index + 1);
  }
  return false;
}

// 网址结尾通常是仓库、页面等资源名，忽略末尾的 /、查询参数和锚点。
function urlEndsWith(url, query) {
  return url.replace(/[?#].*$/, "").replace(/\/+$/, "").endsWith(query);
}

function matchTier(item, query) {
  const title = item.lowerTitle;
  const url = item.lowerDisplayUrl;

  if (title.startsWith(query) || url.startsWith(query) || urlEndsWith(url, query)) {
    return MatchTier.PREFIX;
  }
  if (includesAtWordStart(title, query) || includesAtWordStart(url, query)) return MatchTier.WORD_START;
  if (title.includes(query)) return MatchTier.TITLE;
  if (url.includes(query)) return MatchTier.URL;

  const words = query.split(/\s+/).filter(Boolean);
  if (words.length < 2) return MatchTier.NONE;

  // 多个词可以分别出现在标题和网址中，例如 “github.com svelte”。
  const text = `${title} ${url}`;
  if (!words.every((word) => text.includes(word))) return MatchTier.NONE;
  if (words.every((word) => includesAtWordStart(text, word))) return MatchTier.ALL_WORD_STARTS;
  return MatchTier.ALL_WORDS;
}

export function filterHistory(results, query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return results;

  return results
    .map((item) => ({ item, tier: matchTier(item, normalizedQuery) }))
    .filter(({ tier }) => tier !== MatchTier.NONE)
    .sort((a, b) => a.tier - b.tier || b.item.lastVisitTime - a.item.lastVisitTime)
    .map(({ item }) => item);
}

function actionItem({ url, query, label, domain, faviconUrl }) {
  return {
    url,
    title: query,
    displayUrl: label,
    favicon: faviconUrl(`https://${domain}`),
    action: true,
  };
}

function possibleUrl(query) {
  const value = query.trim();
  if (!value || /\s/.test(value)) return "";

  if (/^https?:\/\//i.test(value)) return safeUrl(value);
  if (/^(localhost|\d{1,3}(?:\.\d{1,3}){3})(:\d+)?(?:\/.*)?$/i.test(value)) {
    return safeUrl(`http://${value}`);
  }
  if (/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z]{2,}(?::\d+)?(?:\/.*)?$/i.test(value)) {
    return safeUrl(`https://${value}`);
  }
  return "";
}

export function getSearchTerms(search) {
  const value = search.trim();
  const providerPrefix = Object.keys(SEARCH_PROVIDERS).find((prefix) => value.startsWith(prefix));
  if (providerPrefix) return value.slice(providerPrefix.length).trim();
  if (/^t(?:\s|$)/.test(value)) return value.slice(1).trim();
  if (value.startsWith("l ")) return value.slice(2).trim();
  return value;
}

export function createDisplayList(results, search, faviconUrl = () => "") {
  const value = search.trim();
  if (/^t(?:\s|$)/.test(value)) {
    return filterHistory(results.filter((item) => item.tabId !== undefined), getSearchTerms(value))
      .slice(0, MAX_LIST_ITEMS)
      .map((item) => ({ ...item, favicon: faviconUrl(item.url) }));
  }
  let historyQuery = value;
  const actions = [];

  const providerPrefix = Object.keys(SEARCH_PROVIDERS).find((prefix) => value.startsWith(prefix));
  if (providerPrefix) {
    const provider = SEARCH_PROVIDERS[providerPrefix];
    const query = value.slice(providerPrefix.length).trim();
    historyQuery = `${provider.domain} ${query}`.trim();
    if (query) {
      actions.push(actionItem({
        url: provider.url(query),
        query,
        label: provider.label,
        domain: provider.domain,
        faviconUrl,
      }));
    }
  } else if (value.startsWith("l ")) {
    const port = value.slice(2).trim();
    historyQuery = `localhost:${port}`;
    if (/^\d{1,5}$/.test(port) && Number(port) <= 65_535) {
      actions.push(actionItem({
        url: `http://localhost:${port}/`,
        query: `localhost:${port}`,
        label: "打开 localhost",
        domain: "localhost",
        faviconUrl,
      }));
    }
  } else if (value) {
    actions.push(actionItem({
      url: `https://www.google.com/search?q=${encodeURIComponent(value)}`,
      query: value,
      label: "使用 Google 搜索",
      domain: "google.com",
      faviconUrl,
    }));
  }

  const url = possibleUrl(value);
  if (url) {
    actions.unshift(actionItem({
      url,
      query: value,
      label: "打开网址",
      domain: new URL(url).hostname,
      faviconUrl,
    }));
  }

  return removeDuplicateUrls([
    ...actions,
    ...filterHistory(results.filter((item) => item.tabId === undefined), historyQuery).slice(0, MAX_LIST_ITEMS),
  ])
    .slice(0, MAX_LIST_ITEMS + actions.length)
    .map((item) => item.favicon ? item : { ...item, favicon: faviconUrl(item.url) });
}

export function highlightParts(text, search) {
  const value = String(text || "");
  const words = [...new Set(getSearchTerms(search).toLocaleLowerCase().split(/\s+/).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  if (!words.length) return [{ text: value, match: false }];

  const lowerValue = value.toLocaleLowerCase();
  const parts = [];
  let cursor = 0;

  while (cursor < value.length) {
    let matchIndex = -1;
    let matchWord = "";
    for (const word of words) {
      const index = lowerValue.indexOf(word, cursor);
      if (index !== -1 && (matchIndex === -1 || index < matchIndex)) {
        matchIndex = index;
        matchWord = word;
      }
    }

    if (matchIndex === -1) {
      parts.push({ text: value.slice(cursor), match: false });
      break;
    }
    if (matchIndex > cursor) parts.push({ text: value.slice(cursor, matchIndex), match: false });
    parts.push({ text: value.slice(matchIndex, matchIndex + matchWord.length), match: true });
    cursor = matchIndex + matchWord.length;
  }

  return parts.length ? parts : [{ text: value, match: false }];
}
