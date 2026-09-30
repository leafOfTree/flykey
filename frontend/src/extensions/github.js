export function toggleFiles() {
  const selector = "table[aria-labelledby='folders-and-files'] tbody tr:not(:first-child)";
  const files = Array.from(document.querySelectorAll(selector));
  if (!files.length) return;

  const shouldHide = files.some((file) => getComputedStyle(file).display !== "none");
  files.forEach((file) => {
    file.style.display = shouldHide ? "none" : "table-row";
  });
}

