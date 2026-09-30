export function scrollByInstantly(element, top) {
  element.scrollBy({ top, behavior: "instant" });
}
