<script>
  import { onDestroy, onMount } from "svelte";
  import Command from "./Command.svelte";
  import { toggleFiles } from "./extensions/github.js";
  import { stopSayContent, toggleSayContent } from "./extensions/talk.js";
  import { MessageType, sendExtensionMessage } from "./lib/extension-api.js";
  import {
    getEventElement,
    getKey,
    getVisibleClientRect,
    isEditableElement,
    isElementVisible,
    isElementVisibleWithStyle,
  } from "./lib/keyboard.js";
  import { requestExtensionReload } from "./lib/reload.js";
  import { scrollByInstantly } from "./lib/scroll.js";
  import { DISABLED_SITES_KEY, getSiteKey, isSiteEnabled as getSiteEnabled } from "../../common/site-settings.js";
  import Toast from "./lib/Toast.svelte";

  const MODE = Object.freeze({ HINT: "hint", INSERT: "insert", NORMAL: "normal" });
  const HINT_KEYS = "asdfghjkl;";
  const MAX_HINTS = HINT_KEYS.length ** 2;
  const SEQUENCE_TIMEOUT_MS = 1_500;
  const CLICKABLE_SELECTOR = [
    "a[href]",
    "button",
    "input:not([type='hidden'])",
    "select",
    "textarea",
    "summary",
    "[role='button']",
    "[role='link']",
    "[onclick]",
  ].join(",");
  const enhancedInputs = new WeakSet();
  const pressedKeys = new Set();

  let mode = MODE.NORMAL;
  let sequencePrefix = "";
  let sequenceTimer;
  let activeScrollKey = "";
  let scrollAnimationFrame;
  let hints = [];
  let isCommandShown = false;
  let isToastShown = false;
  let toastMessage = "";
  let toastType = "info";
  let toastTimer;
  let isReading = false;
  let isNormalKeymapEnabled = true;
  let isSiteEnabled = !globalThis.chrome?.runtime?.id;
  const siteKey = getSiteKey(window.location.href);

  function setMode(nextMode) {
    clearSequence();
    mode = nextMode;
  }

  function clearSequence() {
    sequencePrefix = "";
    clearTimeout(sequenceTimer);
  }

  function rememberSequence(prefix) {
    sequencePrefix = prefix;
    clearTimeout(sequenceTimer);
    sequenceTimer = setTimeout(clearSequence, SEQUENCE_TIMEOUT_MS);
  }

  function showNotification(message, type = "info") {
    toastMessage = message;
    toastType = type;
    isToastShown = true;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (isToastShown = false), 1800);
  }

  function userErrorMessage(error, fallback) {
    const message = String(error?.message || "").trim();
    return /[\u3400-\u9fff]/.test(message) ? message : fallback;
  }

  function handleSpeechState(state) {
    isReading = state === "speaking";
    if (state === "speaking") showNotification("已开始朗读。", "success");
    else if (state === "stopped") showNotification("已结束朗读。");
    else if (state === "finished") showNotification("朗读已完成。", "success");
    else if (state === "error") showNotification("朗读失败，请稍后重试。", "error");
  }

  function toggleReading() {
    return toggleSayContent(handleSpeechState);
  }

  async function runCommand(command) {
    try {
      return await command();
    } catch (error) {
      showNotification(userErrorMessage(error, "Flykey 无法完成此操作。"), "error");
      return undefined;
    }
  }

  function onKeydown(event) {
    if (!event.isTrusted) return;
    if (!isSiteEnabled && !isCommandShown) return;
    const key = getKey(event);
    if (!key) return;

    const target = getEventElement(event);
    const editable = isEditableElement(target);
    if (!isCommandShown && editable && mode !== MODE.HINT) {
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) enhanceInput(target);
      setMode(MODE.INSERT);
    } else if (!isCommandShown && !editable && mode === MODE.INSERT) {
      setMode(MODE.NORMAL);
    }

    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (pressedKeys.has(key) || event.repeat) return;
    pressedKeys.add(key);

    if (mode === MODE.INSERT) {
      if (key === "escape") exitInsertMode(event);
    } else if (mode === MODE.HINT) {
      handleHintKey(key, event);
    } else {
      handleNormalKey(key, event);
    }
  }

  function onKeyup(event) {
    if (!event.isTrusted) return;
    const key = getKey(event);
    if (!key) return;
    pressedKeys.delete(key);
    if (key === activeScrollKey) stopContinuousScroll();
  }

  function onWindowBlur() {
    pressedKeys.clear();
    stopContinuousScroll();
    clearSequence();
  }

  function handleNormalKey(key, event) {
    const toggleCommand = key === ";";
    if (!isNormalKeymapEnabled && !toggleCommand) return;

    const combinedKey = sequencePrefix ? sequencePrefix + key : key;
    const combinedCommand = normalKeydownMappings[combinedKey];
    if (combinedCommand) {
      consumeEvent(event);
      clearSequence();
      void runCommand(() => combinedCommand(event));
      return;
    }

    const directCommand = normalKeydownMappings[key];
    const isPrefix = Object.keys(normalKeydownMappings).some(
      (mapping) => mapping.length > key.length && mapping.startsWith(key),
    );

    if (sequencePrefix) clearSequence();
    if (directCommand) {
      consumeEvent(event);
      void runCommand(() => directCommand(event));
    } else if (isPrefix) {
      consumeEvent(event);
      rememberSequence(key);
    }
  }

  function consumeEvent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function handleHintKey(key, event) {
    consumeEvent(event);
    if (key === "escape") {
      removeHints();
      return;
    }

    const candidate = sequencePrefix + key.toLowerCase();
    const exactHint = hints.find((hint) => hint.key === candidate);
    if (exactHint) {
      selectHint(exactHint.element);
      return;
    }

    if (hints.some((hint) => hint.key.startsWith(candidate))) {
      rememberSequence(candidate);
    } else {
      removeHints();
    }
  }

  function getScrollElement() {
    let element = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    while (element && element !== document.documentElement) {
      const style = getComputedStyle(element);
      if (
        /(auto|scroll|overlay)/.test(style.overflowY) &&
        element.scrollHeight > element.clientHeight + 8
      ) {
        return element;
      }
      element = element.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function startContinuousScroll(offset) {
    activeScrollKey = [...pressedKeys].at(-1) || "";
    const scrollElement = getScrollElement();
    const tick = () => {
      scrollByInstantly(scrollElement, offset);
      if (activeScrollKey && pressedKeys.has(activeScrollKey)) {
        scrollAnimationFrame = requestAnimationFrame(tick);
      }
    };
    tick();
  }

  function stopContinuousScroll() {
    activeScrollKey = "";
    cancelAnimationFrame(scrollAnimationFrame);
  }

  function scrollDown() {
    startContinuousScroll(40);
  }

  function scrollUp() {
    startContinuousScroll(-40);
  }

  function scrollToEdge(top) {
    const element = getScrollElement();
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ top: top ? 0 : element.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function goToParentUrl() {
    const url = new URL(window.location.href);
    const segments = url.pathname.split("/").filter(Boolean);
    segments.pop();
    url.pathname = `/${segments.join("/")}${segments.length ? "/" : ""}`;
    url.search = "";
    url.hash = "";
    window.location.assign(url);
  }

  function goToRootUrl() {
    window.location.assign(window.location.origin);
  }

  function showCommand() {
    setMode(MODE.INSERT);
    isCommandShown = true;
  }

  function hideCommand() {
    isCommandShown = false;
    setMode(MODE.NORMAL);
  }

  function enhanceInput(input) {
    if (enhancedInputs.has(input)) return;
    enhancedInputs.add(input);

    input.addEventListener("keydown", (event) => {
      const key = getKey(event);
      if (!event.ctrlKey || !["u", "w", "d"].includes(key)) return;

      event.preventDefault();
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      let deleteFrom = start;
      let deleteTo = end;

      if (key === "u") deleteFrom = 0;
      if (key === "d" && start === end) deleteTo = Math.min(input.value.length, end + 1);
      if (key === "w" && start === end) {
        deleteFrom = input.value.slice(0, start).search(/\S+\s*$/);
        if (deleteFrom === -1) deleteFrom = 0;
      }

      input.setRangeText("", deleteFrom, deleteTo, "end");
      input.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: key === "d" ? "deleteContentForward" : "deleteContentBackward",
      }));
    });
  }

  function focusFirstInput(event) {
    const targets = document.querySelectorAll(
      'textarea, input:not([type="hidden"]):not([disabled]):not([readonly]), [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
    );
    const target = [...targets].find(isElementVisible);
    if (!target) {
      showNotification("当前页面没有可用的输入框。");
      return;
    }

    event.preventDefault();
    target.focus({ preventScroll: false });
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) enhanceInput(target);
    setMode(MODE.INSERT);
  }

  function exitInsertMode(event) {
    consumeEvent(event);
    const target = getEventElement(event);
    if (target instanceof HTMLElement) target.blur();
    hideCommand();
  }

  async function addBookmark() {
    await sendExtensionMessage(MessageType.ADD_BOOKMARK, {
      url: window.location.href,
      title: document.title,
    });
    showNotification("书签已添加。", "success");
  }

  async function copyText(value, label) {
    await navigator.clipboard.writeText(value);
    showNotification(`${label}已复制。`, "success");
  }

  function getHintCandidate(element, getStyle) {
    if (!isElementVisibleWithStyle(element, getStyle) || element.matches(":disabled, [aria-disabled='true']")) return null;
    const rect = getVisibleClientRect(element, getStyle);
    return rect ? { element, rect } : null;
  }

  function showHints() {
    const styleCache = new WeakMap();
    const getCachedStyle = (element) => {
      if (!styleCache.has(element)) styleCache.set(element, getComputedStyle(element));
      return styleCache.get(element);
    };
    const candidates = [];
    for (const element of document.querySelectorAll(CLICKABLE_SELECTOR)) {
      const candidate = getHintCandidate(element, getCachedStyle);
      if (candidate) candidates.push(candidate);
      if (candidates.length === MAX_HINTS) break;
    }
    const singleKey = candidates.length <= HINT_KEYS.length;

    hints = candidates.map(({ element, rect }, index) => {
      const key = singleKey
        ? HINT_KEYS[index]
        : HINT_KEYS[Math.floor(index / HINT_KEYS.length)] + HINT_KEYS[index % HINT_KEYS.length];
      return { element, key, top: rect.top, left: rect.left };
    });

    if (!hints.length) {
      showNotification("当前页面没有可点击的元素。");
      return;
    }
    setMode(MODE.HINT);
  }

  function removeHints() {
    hints = [];
    setMode(MODE.NORMAL);
  }

  function selectHint(element) {
    removeHints();
    element.focus?.({ preventScroll: true });

    const href = element instanceof HTMLAnchorElement ? element.getAttribute("href") || "" : "";
    if (/^https?:\/\//i.test(href)) {
      void runCommand(() => sendExtensionMessage(MessageType.NEW_TAB, { url: href }));
    } else {
      element.click();
    }
  }

  async function showVideoFullscreen() {
    const video = [...document.querySelectorAll("video")].find(isElementVisible);
    if (video) await video.requestFullscreen();
    else showNotification("当前页面没有可见的视频。");
  }

  function findPaginationLink(direction) {
    const pattern = direction === "previous" ? /previous|prev|上一页|上页/i : /next|下一页|下页/i;
    return [...document.querySelectorAll("a[href], button")].find((element) => {
      const label = `${element.textContent || ""} ${element.getAttribute("aria-label") || ""}`.trim();
      return pattern.test(label) && isElementVisible(element);
    });
  }

  function movePage(direction) {
    const target = findPaginationLink(direction);
    if (target) target.click();
    else showNotification(direction === "previous" ? "未找到上一页链接。" : "未找到下一页链接。");
  }

  function toggleNormalKeymap() {
    isNormalKeymapEnabled = !isNormalKeymapEnabled;
    showNotification(`Flykey 快捷键已${isNormalKeymapEnabled ? "启用" : "暂停"}。`);
  }

  function syncActionState(enabled) {
    void sendExtensionMessage(MessageType.UPDATE_ACTION_STATE, { enabled }).catch(() => {});
  }

  function applySiteSettings(disabledSites) {
    const nextEnabled = getSiteEnabled(disabledSites, siteKey);
    syncActionState(nextEnabled);
    if (nextEnabled === isSiteEnabled) return;

    isSiteEnabled = nextEnabled;
    isNormalKeymapEnabled = true;
    clearSequence();
    pressedKeys.clear();
    stopContinuousScroll();
    removeHints();
    if (!nextEnabled) hideCommand();
  }

  function reloadExtension() {
    requestExtensionReload(
      () => sendExtensionMessage(MessageType.RELOAD_EXTENSION),
      () => window.location.reload(),
    );
  }

  const enableHints = !window.location.hostname.endsWith("youtube.com");
  const normalKeydownMappings = {
    i: focusFirstInput,
    j: scrollDown,
    k: scrollUp,
    r: () => window.location.reload(),
    t: () => sendExtensionMessage(MessageType.NEW_TAB),
    h: () => sendExtensionMessage(MessageType.PREVIOUS_TAB),
    l: () => sendExtensionMessage(MessageType.NEXT_TAB),
    ...(enableHints ? { f: showHints } : {}),
    F: showVideoFullscreen,
    G: () => scrollToEdge(false),
    gg: () => scrollToEdge(true),
    gh: goToRootUrl,
    gr: reloadExtension,
    gu: goToParentUrl,
    w: () => history.back(),
    e: () => history.forward(),
    o: showCommand,
    d: () => sendExtensionMessage(MessageType.CLOSE_TAB),
    b: addBookmark,
    y: () => copyText(window.location.href, "网址"),
    Y: () => copyText(document.title, "标题"),
    gx: async () => {
      const result = await sendExtensionMessage(MessageType.CLOSE_OTHER_TABS);
      showNotification(`已关闭 ${result.closedCount} 个其他标签页。`);
    },
    u: () => sendExtensionMessage(MessageType.REOPEN_TAB),
    s: toggleReading,
    "[": () => movePage("previous"),
    "]": () => movePage("next"),
    "\\": toggleFiles,
    ";": toggleNormalKeymap,
    "?": () => sendExtensionMessage(MessageType.OPEN_HELP),
  };

  onMount(() => {
    const runtime = globalThis.chrome?.runtime;
    const storage = globalThis.chrome?.storage;
    if (!runtime) {
      isSiteEnabled = true;
      return undefined;
    }

    const showCommandFromToolbar = (message) => {
      if (message?.type !== MessageType.SHOW_COMMAND) return undefined;
      showCommand();
      return undefined;
    };

    const handleStorageChange = (changes, areaName) => {
      if (areaName === "local" && changes[DISABLED_SITES_KEY]) {
        applySiteSettings(changes[DISABLED_SITES_KEY].newValue);
      }
    };

    runtime.onMessage.addListener(showCommandFromToolbar);
    if (storage?.local && siteKey) {
      storage.local
        .get(DISABLED_SITES_KEY)
        .then((stored) => applySiteSettings(stored[DISABLED_SITES_KEY]))
        .catch(() => {
          isSiteEnabled = true;
          syncActionState(true);
        });
      storage.onChanged.addListener(handleStorageChange);
    } else {
      isSiteEnabled = true;
      syncActionState(true);
    }

    return () => {
      runtime.onMessage.removeListener(showCommandFromToolbar);
      storage?.onChanged.removeListener(handleStorageChange);
    };
  });

  onDestroy(() => {
    stopSayContent();
    clearTimeout(sequenceTimer);
    clearTimeout(toastTimer);
    cancelAnimationFrame(scrollAnimationFrame);
  });
</script>

<svelte:window
  on:keydown|capture={onKeydown}
  on:keyup|capture={onKeyup}
  on:blur={onWindowBlur}
/>

{#if mode === MODE.HINT}
  <div class="hints" aria-hidden="true">
    {#each hints as hint (hint.key)}
      {#if !sequencePrefix || hint.key.startsWith(sequencePrefix)}
        <div class="hint" style={`top: ${hint.top}px; left: ${hint.left}px`}>
          {#each [...hint.key] as character, index}
            <span class:matched={index < sequencePrefix.length}>{character}</span>
          {/each}
        </div>
      {/if}
    {/each}
  </div>
{/if}

{#if isCommandShown}
  <Command on:exit={hideCommand} />
{/if}

{#if isToastShown}
  <Toast type={toastType}>{toastMessage}</Toast>
{/if}

{#if isReading}
  <div class="reading-status" role="status" aria-live="polite">
    <span aria-hidden="true"></span>
    朗读中 · 按 s 结束
  </div>
{/if}

<style lang="scss">
  .reading-status {
    position: fixed;
    z-index: 2147483646;
    top: 20px;
    left: 50%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 9px 13px;
    border: 1px solid rgb(255 255 255 / 14%);
    border-radius: 999px;
    color: #fff;
    background: rgb(30 41 59 / 94%);
    box-shadow: 0 8px 24px rgb(0 0 0 / 24%);
    font: 600 13px/1.4 ui-sans-serif, system-ui, sans-serif;
    transform: translateX(-50%);
    pointer-events: none;
  }

  .reading-status span {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 0 4px rgb(74 222 128 / 14%);
  }

  .hints {
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    pointer-events: none;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }

  .hint {
    position: fixed;
    min-width: 16px;
    box-sizing: border-box;
    padding: 1px 4px;
    border: 1px solid #b7791f;
    border-radius: 4px;
    color: #111827;
    background: linear-gradient(#fff9a8, #fbbf24);
    box-shadow: 0 2px 7px rgb(0 0 0 / 32%);
    font-size: 12px;
    font-weight: 800;
    line-height: 16px;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .matched {
    opacity: 0.3;
  }
</style>
