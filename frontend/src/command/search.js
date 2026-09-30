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

export function removeDuplicateUrls(results) {
  const seen = new Set();
  return results.filter((result) => {
    const key = result.url.replace(/#.*/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function matchScore(item, query) {
  if (!query) return 0;

  const normalizedQuery = query.toLocaleLowerCase();
  const titleIndex = item.lowerTitle.indexOf(normalizedQuery);
  if (titleIndex >= 0) return titleIndex;

  const urlIndex = item.lowerDisplayUrl.indexOf(normalizedQuery);
  if (urlIndex >= 0) return 100 + urlIndex;

  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  if (words.every((word) => item.lowerTitle.includes(word))) return 1_000;
  if (words.every((word) => item.lowerDisplayUrl.includes(word))) return 2_000;
  return -1;
}

export function filterHistory(results, query) {
  if (!query) return results;

  return results
    .map((item) => ({ item, score: matchScore(item, query) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => a.score - b.score || b.item.lastVisitTime - a.item.lastVisitTime)
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
  if (value.startsWith("l ")) return value.slice(2).trim();
  return value;
}

export function createDisplayList(results, search, faviconUrl = () => "") {
  const value = search.trim();
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
    ...filterHistory(results, historyQuery).slice(0, MAX_LIST_ITEMS),
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
