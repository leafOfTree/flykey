import assert from "node:assert/strict";
import test from "node:test";
import { requestExtensionReload } from "../frontend/src/lib/reload.js";

test("extension reload request is sent before the page reloads", () => {
  const calls = [];
  requestExtensionReload(
    () => {
      calls.push("send");
      return new Promise(() => {});
    },
    () => calls.push("reload-page"),
  );

  assert.deepEqual(calls, ["send", "reload-page"]);
});

test("page reload is not blocked by a failed extension message", async () => {
  const calls = [];
  requestExtensionReload(
    () => Promise.reject(new Error("Extension context was reloaded.")),
    () => calls.push("reload-page"),
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, ["reload-page"]);
});

test("page reload still runs if sending throws synchronously", () => {
  const calls = [];
  assert.throws(
    () => requestExtensionReload(
      () => {
        throw new Error("No runtime");
      },
      () => calls.push("reload-page"),
    ),
    /No runtime/,
  );
  assert.deepEqual(calls, ["reload-page"]);
});
