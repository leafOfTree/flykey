import { MessageType } from "../common/messages.js";
import { DISABLED_SITES_KEY, getSiteKey, normalizeDisabledSites } from "../common/site-settings.js";

const siteName = document.querySelector("#site-name");
const siteToggle = document.querySelector("#site-toggle");
const stateLabel = document.querySelector("#state-label");
const openCommand = document.querySelector("#open-command");
const openHelp = document.querySelector("#open-help");
const status = document.querySelector("#status");

let activeTabId;
let siteKey = "";

function showStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle("error", error);
}

async function initialize() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id;
    siteKey = getSiteKey(tab?.url || "");

    if (activeTabId === undefined || !siteKey) {
      siteName.textContent = "此页面不支持 Flykey";
      showStatus("Chrome 内部页面无法使用扩展快捷键。", true);
      return;
    }

    const stored = await chrome.storage.local.get(DISABLED_SITES_KEY);
    const disabledSites = normalizeDisabledSites(stored[DISABLED_SITES_KEY]);
    siteName.textContent = siteKey;
    siteToggle.checked = !disabledSites.includes(siteKey);
    stateLabel.textContent = siteToggle.checked ? "已启用" : "已停用";
    siteToggle.disabled = false;
    openCommand.disabled = false;
  } catch (error) {
    siteName.textContent = "读取失败";
    showStatus("无法读取当前网站。", true);
  }
}

siteToggle.addEventListener("change", async () => {
  try {
    const stored = await chrome.storage.local.get(DISABLED_SITES_KEY);
    const disabledSites = new Set(normalizeDisabledSites(stored[DISABLED_SITES_KEY]));
    if (!siteToggle.checked) disabledSites.add(siteKey);
    else disabledSites.delete(siteKey);

    await chrome.storage.local.set({ [DISABLED_SITES_KEY]: [...disabledSites].sort() });
    stateLabel.textContent = siteToggle.checked ? "已启用" : "已停用";
    showStatus(siteToggle.checked ? "已在此网站启用。" : "已在此网站停用。");
  } catch {
    siteToggle.checked = !siteToggle.checked;
    showStatus("保存设置失败。", true);
  }
});

openCommand.addEventListener("click", async () => {
  try {
    await chrome.tabs.sendMessage(activeTabId, { type: MessageType.SHOW_COMMAND });
    window.close();
  } catch {
    showStatus("此页面暂时无法打开命令面板，请刷新后重试。", true);
  }
});

openHelp.addEventListener("click", async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: MessageType.OPEN_HELP });
    if (!response?.ok) throw new Error(response?.error || "无法打开帮助页面。");
    window.close();
  } catch {
    showStatus("无法打开帮助页面。", true);
  }
});

void initialize();
