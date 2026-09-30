<script>
  import { createEventDispatcher, onMount } from "svelte";
  import { createDisplayList, highlightParts, normalizeHistoryResults } from "./command/search.js";
  import {
    getFaviconUrl,
    hasExtensionApi,
    MessageType,
    sendExtensionMessage,
  } from "./lib/extension-api.js";
  import { getKey } from "./lib/keyboard.js";

  const dispatch = createEventDispatcher();
  let resultList = [];
  let displayList = [];
  let search = "";
  let itemIndex = 0;
  let input;
  let list;
  let loading = true;
  let errorMessage = "";

  function userErrorMessage(error) {
    const message = String(error?.message || "").trim();
    return /[\u3400-\u9fff]/.test(message) ? message : "命令执行失败，请稍后重试。";
  }

  onMount(() => {
    let active = true;
    input?.focus();

    if (!hasExtensionApi()) {
      resultList = normalizeHistoryResults([
        { title: "示例网站", url: "https://example.com", lastVisitTime: Date.now() },
        { title: "Svelte", url: "https://svelte.dev", lastVisitTime: Date.now() - 1 },
      ]);
      updateList();
      loading = false;
      return () => {
        active = false;
      };
    }

    sendExtensionMessage(MessageType.SEARCH_HISTORY)
      .then((results) => {
        if (!active) return;
        resultList = normalizeHistoryResults(results);
        updateList();
      })
      .catch((error) => {
        if (active) errorMessage = userErrorMessage(error);
      })
      .finally(() => {
        if (active) loading = false;
      });

    return () => {
      active = false;
    };
  });

  function updateList() {
    displayList = createDisplayList(resultList, search, getFaviconUrl);
    if (itemIndex >= displayList.length) itemIndex = Math.max(0, displayList.length - 1);
  }

  function updateInputValue(value) {
    search = value;
    itemIndex = 0;
    updateList();
  }

  function editInput(event) {
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
      const beforeCursor = input.value.slice(0, start);
      deleteFrom = beforeCursor.search(/\S+\s*$/);
      if (deleteFrom === -1) deleteFrom = 0;
    }

    input.setRangeText("", deleteFrom, deleteTo, "end");
    updateInputValue(input.value);
  }

  function scrollToSelectedItem() {
    requestAnimationFrame(() => {
      list?.querySelector(".selected")?.scrollIntoView({ block: "nearest" });
    });
  }

  async function openItem(index = itemIndex, newTab = true) {
    const item = displayList[index];
    if (!item) return;

    try {
      if (newTab) {
        if (hasExtensionApi()) await sendExtensionMessage(MessageType.NEW_TAB, { url: item.url });
        else window.open(item.url, "_blank", "noopener,noreferrer");
      } else {
        window.location.assign(item.url);
      }
      dispatch("exit");
    } catch (error) {
      errorMessage = userErrorMessage(error);
    }
  }

  function onInput(event) {
    updateInputValue(event.currentTarget.value);
  }

  function onKeydown(event) {
    editInput(event);
    if (event.defaultPrevented) return;

    const key = getKey(event);
    if (key === "arrowup" || key === "arrowdown") {
      event.preventDefault();
      const offset = key === "arrowup" ? -1 : 1;
      itemIndex = Math.min(Math.max(itemIndex + offset, 0), Math.max(0, displayList.length - 1));
      scrollToSelectedItem();
    } else if (key === "enter") {
      event.preventDefault();
      openItem(itemIndex, !event.ctrlKey && !event.metaKey);
    }
  }

  function onBackdropClick(event) {
    if (event.target === event.currentTarget) dispatch("exit");
  }

  function hideBrokenImage(event) {
    event.currentTarget.style.visibility = "hidden";
  }
</script>

<div class="command" role="presentation" on:click={onBackdropClick}>
  <div class="container" role="dialog" aria-modal="true" aria-label="搜索浏览历史">
    <div class="input-container">
      <input
        bind:this={input}
        value={search}
        on:input={onInput}
        on:keydown|stopPropagation={onKeydown}
        role="combobox"
        aria-label="搜索历史记录或输入网址"
        aria-controls="flykey-results"
        aria-expanded="true"
        aria-autocomplete="list"
        aria-activedescendant={displayList.length ? `flykey-result-${itemIndex}` : undefined}
        autocomplete="off"
        spellcheck="false"
      />
    </div>

    <div class="list" id="flykey-results" role="listbox" bind:this={list} aria-label="搜索结果">
      {#if errorMessage}
        <div class="status error" role="alert">{errorMessage}</div>
      {:else if !loading && !displayList.length}
        <div class="status">没有匹配的历史记录。</div>
      {/if}

      {#each displayList as item, index (item.url)}
        <button
          type="button"
          id={`flykey-result-${index}`}
          class="item"
          class:selected={index === itemIndex}
          class:action={item.action}
          role="option"
          aria-selected={index === itemIndex}
          on:mouseenter={() => (itemIndex = index)}
          on:click={(event) => openItem(index, event.ctrlKey || event.metaKey)}
        >
          <span class="icon-container" aria-hidden="true">
            {#if item.favicon}
              <img src={item.favicon} alt="" on:error={hideBrokenImage} />
            {/if}
          </span>
          <span class="text-container">
            <span class="title">
              {#each highlightParts(item.title, search) as part}
                <span class:match={part.match}>{part.text}</span>
              {/each}
            </span>
            <span class="url">
              {#each highlightParts(item.displayUrl, search) as part}
                <span class:match={part.match}>{part.text}</span>
              {/each}
            </span>
          </span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style lang="scss">
  .command {
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: min(12vh, 112px) 16px 16px;
    color: #fff;
    background: rgb(0 0 0 / 10%);
    font-size: 16px;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    text-size-adjust: 100%;
    -webkit-text-size-adjust: 100%;
  }

  .container {
    width: min(736px, calc(100vw - 32px));
    max-height: min(704px, calc(100vh - min(12vh, 112px) - 32px));
    overflow: hidden;
    border: 1px solid #423f3f;
    border-radius: 14px;
    background: #423f3f;
    box-shadow: 0 0 0 2px #423f3f, 5px 5px 16px rgb(0 0 0 / 30%);
  }

  .input-container {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
  }

  input {
    box-sizing: border-box;
    flex: 1;
    min-width: 0;
    height: 48px;
    padding: 0 14px;
    border: 0;
    border-radius: 9px;
    outline: none;
    color: #fff;
    background: #2c2a2a;
    font: inherit;
    font-size: 24px;
  }

  .list {
    box-sizing: border-box;
    height: calc(min(704px, calc(100vh - min(12vh, 112px) - 32px)) - 80px);
    overflow-y: auto;
    padding: 8px;
    scrollbar-color: #686565 transparent;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
  }

  .list::-webkit-scrollbar {
    width: 10px;
  }

  .list::-webkit-scrollbar-track {
    background: transparent;
  }

  .list::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 999px;
    background: #686565;
    background-clip: content-box;
  }

  .list::-webkit-scrollbar-thumb:hover {
    background-color: #858181;
  }

  .item {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    width: 100%;
    gap: 11px;
    padding: 10px 12px;
    border: 0;
    border-radius: 9px;
    color: inherit;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  .item:hover,
  .item.selected {
    background: #2f6e70;
  }

  .item:focus-visible {
    outline: 2px solid #00ff7f;
    outline-offset: -2px;
  }

  .icon-container {
    display: grid;
    flex: 0 0 32px;
    width: 32px;
    height: 32px;
    place-items: center;
  }

  img {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    object-fit: contain;
  }

  .text-container {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: 2px;
  }

  .title,
  .url {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title {
    font-size: 18px;
    font-weight: 650;
  }

  .url {
    color: #ddd;
    font-size: 16px;
  }

  .action .url {
    color: #ddd;
  }

  :global(.match) {
    color: #00ff7f;
  }

  .status {
    padding: 32px 16px;
    color: #ddd;
    text-align: center;
  }

  .status.error {
    color: #fecaca;
  }

  @media (max-width: 600px) {
    .command {
      padding: 16px 8px;
    }

    .container {
      width: calc(100vw - 16px);
      max-height: calc(100vh - 32px);
    }

    .list {
      height: calc(100vh - 112px);
    }

  }
</style>
