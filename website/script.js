const demoItems = [
  { icon: "G", iconClass: "google", title: "svelte", url: "使用 Google 搜索", keywords: "google search web" },
  { icon: "S", iconClass: "svelte", title: "Svelte • Cybernetically enhanced web apps", url: "svelte.dev", keywords: "svelte docs frontend" },
  { icon: "G", iconClass: "github", title: "sveltejs/svelte", url: "github.com/sveltejs/svelte", keywords: "svelte github repository" },
  { icon: "D", iconClass: "docs", title: "Documentation", url: "developer.chrome.com/docs/extensions", keywords: "chrome extension docs" },
];

const escapeHtml = (value) => value.replace(/[&<>"]/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
})[character]);

function highlight(value, query) {
  const safeValue = escapeHtml(value);
  if (!query) return safeValue;
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safeValue.replace(new RegExp(`(${escapedQuery})`, "ig"), "<mark>$1</mark>");
}

function renderDemoResults() {
  const input = document.querySelector("#demo-input");
  const container = document.querySelector("#demo-results");
  if (!input || !container) return;

  const query = input.value.trim().toLowerCase();
  const items = demoItems
    .filter((item, index) => index === 0 || !query || `${item.title} ${item.url} ${item.keywords}`.toLowerCase().includes(query))
    .slice(0, 3);

  if (!items.length) {
    container.innerHTML = '<div class="demo-empty">没有历史结果 · 按 Enter 使用 Google 搜索</div>';
    return;
  }

  container.innerHTML = items.map((item, index) => `
    <div class="demo-result${index === 0 ? " selected" : ""}">
      <span class="result-icon ${item.iconClass}">${item.icon}</span>
      <span><span class="result-title">${highlight(item.title, query)}</span><span class="result-url">${highlight(item.url, query)}</span></span>
    </div>
  `).join("");
}

const menuButton = document.querySelector(".menu-button");
const navLinks = document.querySelector("#nav-links");
menuButton?.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  navLinks?.classList.toggle("open", open);
});

navLinks?.addEventListener("click", (event) => {
  if (!(event.target instanceof HTMLAnchorElement)) return;
  menuButton?.setAttribute("aria-expanded", "false");
  navLinks.classList.remove("open");
});

document.querySelector("#demo-input")?.addEventListener("input", renderDemoResults);
document.querySelector("#year").textContent = String(new Date().getFullYear());

document.querySelector(".mode-switch")?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;

  document.querySelectorAll(".mode-switch button").forEach((item) => item.classList.toggle("active", item === button));
  document.querySelectorAll(".shortcut-row").forEach((row) => {
    row.hidden = button.dataset.filter !== "all" && row.dataset.category !== button.dataset.filter;
  });
});

window.addEventListener("scroll", () => {
  document.querySelector(".site-header")?.classList.toggle("scrolled", window.scrollY > 8);
}, { passive: true });

renderDemoResults();
