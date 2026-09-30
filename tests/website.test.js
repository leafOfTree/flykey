import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../website/", import.meta.url);
const indexHtml = await readFile(new URL("index.html", siteRoot), "utf8");
const privacyHtml = await readFile(new URL("privacy.html", siteRoot), "utf8");
const styles = await readFile(new URL("styles.css", siteRoot), "utf8");

test("static website contains essential metadata and accessible landmarks", () => {
  assert.match(indexHtml, /<html lang="zh-CN">/);
  assert.match(indexHtml, /<meta name="description"/);
  assert.match(indexHtml, /<meta name="viewport"/);
  assert.match(indexHtml, /<main id="main">/);
  assert.match(indexHtml, /aria-label="主导航"/);
  assert.match(indexHtml, /按网站控制/);
  assert.match(indexHtml, /工具栏开关可长期停用当前网站/);
  assert.match(indexHtml, /打开快捷键与使用帮助/);
  assert.match(indexHtml, /选中即读，再按即停/);
  assert.match(indexHtml, /朗读选区或可见正文；再次按下结束/);
  assert.match(indexHtml, /自动识别中英文/);
  assert.match(indexHtml, /中英文混排/);
  assert.match(indexHtml, /本地系统语音/);
  assert.doesNotMatch(indexHtml, /Press s again/);
  assert.match(indexHtml, /朗读中/);
  assert.match(styles, /\.demo-result\.selected\s*\{[^}]*background:\s*#2f6e70/s);
  assert.match(styles, /\.result-title mark, \.result-url mark\s*\{[^}]*color:\s*#00ff7f/s);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /\.speech-status\s*\{/);
});

test("static website uses local styles, scripts, and images", async () => {
  const assetReferences = [...indexHtml.matchAll(/(?:href|src)="(\.\/[^"]+)"/g)]
    .map((match) => match[1])
    .filter((path) => !path.includes("#"));

  await Promise.all(assetReferences.map((path) => access(new URL(path, siteRoot))));
  assert.equal(indexHtml.includes("<script src=\"http"), false);
  assert.equal(indexHtml.includes("<link rel=\"stylesheet\" href=\"http"), false);
});

test("privacy page publishes the data policy and support contact", () => {
  assert.match(privacyHtml, /数据分享与保留/);
  assert.match(privacyHtml, /没有选区时，只提取页面正文中当前可见区域的文字/);
  assert.match(privacyHtml, /github\.com\/leafOfTree\/flykey\/issues/);
  assert.doesNotMatch(privacyHtml, /replace this section/i);
});
