export const DISABLED_SITES_KEY = "disabledSites";

export function getSiteKey(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function normalizeDisabledSites(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((site) => typeof site === "string" && site.trim()).map((site) => site.toLowerCase()))];
}

export function isSiteEnabled(disabledSites, siteKey) {
  return Boolean(siteKey) && !normalizeDisabledSites(disabledSites).includes(siteKey.toLowerCase());
}
