export function getKey(event) {
  if (event.key === "Shift" || event.key === "Control" || event.key === "Alt" || event.key === "Meta") {
    return "";
  }

  if (event.key.length === 1) return event.key;
  return event.key.toLowerCase();
}

export function getEventElement(event) {
  const target = event.composedPath?.()[0] || event.target;
  return target instanceof Element ? target : null;
}

export function isEditableElement(element) {
  if (!element) return false;

  const editable = element.closest(
    'input:not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="submit"]), textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]',
  );
  return Boolean(editable);
}

export function isElementTreeHidden(element, getStyle = getComputedStyle) {
  for (let current = element; current; current = current.parentElement) {
    const style = getStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.visibility === "collapse" ||
      style.contentVisibility === "hidden" ||
      Number(style.opacity) === 0
    ) {
      return true;
    }
  }
  return false;
}

export function isElementVisibleWithStyle(element, getStyle) {
  if (!(element instanceof HTMLElement) || element.hidden) return false;
  if (element.closest("[hidden], [inert]")) return false;
  if (isElementTreeHidden(element, getStyle)) return false;

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  return true;
}

export function isElementVisible(element) {
  return isElementVisibleWithStyle(element, getComputedStyle);
}

const CLIPPING_OVERFLOW = /^(auto|clip|hidden|overlay|scroll)$/;

export function getVisibleClientRect(
  element,
  getStyle = getComputedStyle,
  viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight },
) {
  const elementRect = element.getBoundingClientRect();
  let left = Math.max(elementRect.left, viewport.left);
  let top = Math.max(elementRect.top, viewport.top);
  let right = Math.min(elementRect.right, viewport.right);
  let bottom = Math.min(elementRect.bottom, viewport.bottom);

  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const style = getStyle(ancestor);
    const containment = String(style.contain || "");
    const clipsPaint = /\b(content|paint|strict)\b/.test(containment);
    const clipsX = clipsPaint || CLIPPING_OVERFLOW.test(style.overflowX);
    const clipsY = clipsPaint || CLIPPING_OVERFLOW.test(style.overflowY);
    if (!clipsX && !clipsY) continue;

    const ancestorRect = ancestor.getBoundingClientRect();
    if (clipsX) {
      left = Math.max(left, ancestorRect.left);
      right = Math.min(right, ancestorRect.right);
    }
    if (clipsY) {
      top = Math.max(top, ancestorRect.top);
      bottom = Math.min(bottom, ancestorRect.bottom);
    }
    if (right <= left || bottom <= top) return null;
  }

  if (right <= left || bottom <= top) return null;
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}
