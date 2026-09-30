import assert from "node:assert/strict";
import test from "node:test";
import { getVisibleClientRect, isElementTreeHidden } from "../frontend/src/lib/keyboard.js";

function createTree(styles) {
  const elements = styles.map(() => ({ parentElement: null }));
  for (let index = 0; index < elements.length - 1; index += 1) {
    elements[index].parentElement = elements[index + 1];
  }
  const styleMap = new Map(elements.map((element, index) => [element, {
    display: "block",
    visibility: "visible",
    contentVisibility: "visible",
    opacity: "1",
    ...styles[index],
  }]));
  return { element: elements[0], getStyle: (target) => styleMap.get(target) };
}

test("hint visibility rejects a visibility-hidden ancestor", () => {
  const tree = createTree([{}, { visibility: "hidden" }, {}]);
  assert.equal(isElementTreeHidden(tree.element, tree.getStyle), true);
});

test("hint visibility rejects other non-rendered ancestor styles", () => {
  for (const hiddenStyle of [
    { display: "none" },
    { visibility: "collapse" },
    { contentVisibility: "hidden" },
    { opacity: "0" },
  ]) {
    const tree = createTree([{}, hiddenStyle]);
    assert.equal(isElementTreeHidden(tree.element, tree.getStyle), true);
  }
});

test("hint visibility accepts a fully visible ancestor chain", () => {
  const tree = createTree([{}, {}, {}]);
  assert.equal(isElementTreeHidden(tree.element, tree.getStyle), false);
});

function createClippedElement(elementRect, ancestorRect, ancestorStyle) {
  const ancestor = {
    parentElement: null,
    getBoundingClientRect: () => ancestorRect,
  };
  const element = {
    parentElement: ancestor,
    getBoundingClientRect: () => elementRect,
  };
  const getStyle = (target) => target === ancestor
    ? { overflowX: "visible", overflowY: "visible", contain: "none", ...ancestorStyle }
    : { overflowX: "visible", overflowY: "visible", contain: "none" };
  return { element, getStyle };
}

test("hint positioning rejects elements fully outside an overflow clip", () => {
  const fixture = createClippedElement(
    { left: 0, top: 100, right: 22, bottom: 122 },
    { left: 300, top: 80, right: 1100, bottom: 500 },
    { overflowX: "hidden" },
  );

  assert.equal(getVisibleClientRect(fixture.element, fixture.getStyle, {
    left: 0,
    top: 0,
    right: 1440,
    bottom: 900,
  }), null);
});

test("hint positioning uses the visible part of a partially clipped element", () => {
  const fixture = createClippedElement(
    { left: 285, top: 100, right: 315, bottom: 130 },
    { left: 300, top: 80, right: 1100, bottom: 500 },
    { overflowX: "auto" },
  );

  assert.deepEqual(getVisibleClientRect(fixture.element, fixture.getStyle, {
    left: 0,
    top: 0,
    right: 1440,
    bottom: 900,
  }), {
    left: 300,
    top: 100,
    right: 315,
    bottom: 130,
    width: 15,
    height: 30,
  });
});
