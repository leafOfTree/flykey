import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const commandSource = await readFile(new URL("../frontend/src/Command.svelte", import.meta.url), "utf8");
const appSource = await readFile(new URL("../frontend/src/App.svelte", import.meta.url), "utf8");
const toastSource = await readFile(new URL("../frontend/src/lib/Toast.svelte", import.meta.url), "utf8");

test("command input does not display placeholder copy", () => {
  assert.doesNotMatch(commandSource, /placeholder=/);
});

test("command palette waits silently while history is loading", () => {
  assert.doesNotMatch(commandSource, /Loading history/);
  assert.match(commandSource, /!loading && !displayList\.length/);
});

test("command palette reserves result space before history arrives", () => {
  assert.match(commandSource, /\.list\s*\{[^}]*height:/s);
  assert.doesNotMatch(commandSource, /\.list\s*\{[^}]*max-height:/s);
});

test("command results use a transparent cross-platform scrollbar", () => {
  assert.match(commandSource, /scrollbar-color:\s*#686565 transparent/);
  assert.match(commandSource, /\.list::\-webkit-scrollbar-track\s*\{[^}]*background:\s*transparent/s);
  assert.match(commandSource, /\.list::\-webkit-scrollbar-thumb\s*\{/);
});

test("injected UI sizing does not inherit the host page root font size", () => {
  assert.doesNotMatch(`${commandSource}\n${appSource}\n${toastSource}`, /\b\d*\.?\d+rem\b/);
  assert.match(commandSource, /\.command\s*\{[^}]*font-size:\s*16px/s);
});

test("question mark opens the bundled help page", () => {
  assert.match(appSource, /"\?":\s*\(\)\s*=>\s*sendExtensionMessage\(MessageType\.OPEN_HELP\)/);
});
