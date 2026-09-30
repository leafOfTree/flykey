import assert from "node:assert/strict";
import test from "node:test";
import { scrollByInstantly } from "../frontend/src/lib/scroll.js";

test("continuous scrolling bypasses a website's smooth-scroll style", () => {
  const calls = [];
  const element = {
    scrollBy(options) {
      calls.push(options);
    },
  };

  scrollByInstantly(element, 40);
  scrollByInstantly(element, -40);

  assert.deepEqual(calls, [
    { top: 40, behavior: "instant" },
    { top: -40, behavior: "instant" },
  ]);
});
