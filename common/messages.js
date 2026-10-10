export const MessageType = Object.freeze({
  ACTIVATE_TAB: "activateTab",
  SEARCH_TABS: "searchTabs",
  ADD_BOOKMARK: "addBookmark",
  CLOSE_OTHER_TABS: "closeOtherTabs",
  CLOSE_TAB: "closeTab",
  NEW_TAB: "newTab",
  NEXT_TAB: "nextTab",
  OPEN_HELP: "openHelp",
  PREVIOUS_TAB: "previousTab",
  RELOAD_EXTENSION: "reloadExtension",
  REOPEN_TAB: "reopenTab",
  SEARCH_HISTORY: "searchHistory",
  SHOW_COMMAND: "showCommand",
  UPDATE_ACTION_STATE: "updateActionState",
});

export const messageTypes = new Set(Object.values(MessageType));
