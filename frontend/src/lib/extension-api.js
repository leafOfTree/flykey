import { MessageType } from "../../../common/messages.js";

export { MessageType };

export function hasExtensionApi() {
  return Boolean(globalThis.chrome?.runtime?.id);
}

export async function sendExtensionMessage(type, payload) {
  if (!hasExtensionApi()) {
    throw new Error("当前页面无法使用 Flykey 扩展接口。");
  }

  const response = await chrome.runtime.sendMessage({ type, payload });
  if (!response?.ok) {
    throw new Error(response?.error || "Flykey 无法完成此操作。");
  }
  return response.data;
}

export function getFaviconUrl(pageUrl) {
  if (!hasExtensionApi()) return "";

  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", "32");
  return url.toString();
}
