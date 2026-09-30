import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const frontendPackage = JSON.parse(await readFile(new URL("../frontend/package.json", import.meta.url), "utf8"));

test("manifest uses Manifest V3 and only declared production assets", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.type, "module");
  assert.deepEqual(manifest.content_scripts[0].js, ["frontend/dist/index.js"]);
  assert.equal(manifest.permissions.includes("tabs"), false);
  assert.equal(manifest.permissions.includes("activeTab"), true);
  assert.equal(manifest.permissions.includes("storage"), true);
  assert.equal(manifest.action.default_popup, "popup/index.html");
});

test("release versions stay in sync", () => {
  assert.equal(packageJson.version, manifest.version);
  assert.equal(frontendPackage.version, manifest.version);
});

test("changelog documents the current release", async () => {
  const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  const [latestRelease] = changelog.match(/^## \S+/m) ?? [];
  assert.equal(latestRelease, `## ${manifest.version}`);
});

test("manifest declares every recommended icon size", () => {
  assert.deepEqual(Object.keys(manifest.icons), ["16", "32", "48", "128"]);
});

test("every manifest runtime asset exists", async () => {
  const assets = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    ...manifest.content_scripts.flatMap((script) => script.js),
    ...Object.values(manifest.icons),
  ];
  await Promise.all(assets.map((asset) => access(new URL(`../${asset}`, import.meta.url))));
});

test("toolbar popup ships only local executable resources", async () => {
  const popupHtml = await readFile(new URL(`../${manifest.action.default_popup}`, import.meta.url), "utf8");
  assert.match(popupHtml, /src="\.\/popup\.js"/);
  assert.match(popupHtml, /href="\.\/popup\.css"/);
  assert.match(popupHtml, /role="switch"/);
  assert.doesNotMatch(popupHtml, /<select/);
  assert.doesNotMatch(popupHtml, /https?:\/\//);

  await Promise.all([
    access(new URL("../popup/popup.js", import.meta.url)),
    access(new URL("../popup/popup.css", import.meta.url)),
    access(new URL("../common/site-settings.js", import.meta.url)),
  ]);
});

test("help page is bundled and documents the public shortcuts", async () => {
  const helpHtml = await readFile(new URL("../help/index.html", import.meta.url), "utf8");
  assert.match(helpHtml, /快捷键与使用帮助/);
  assert.match(helpHtml, /<kbd>\?<\/kbd>/);
  assert.match(helpHtml, /网站长期启用或停用/);
  assert.doesNotMatch(helpHtml, /<script/);

  await access(new URL("../help/help.css", import.meta.url));
});

test("extension and store images have the required dimensions", async () => {
  const images = [
    ...[16, 32, 48, 128].map((size) => [`../icon/${size}.png`, size, size]),
    ["../store-assets/screenshot-command-1280x800.png", 1280, 800],
    ["../store-assets/promo-small-440x280.png", 440, 280],
    ["../docs/images/toolbar-popup.png", 310, 380],
  ];

  for (const [path, expectedWidth, expectedHeight] of images) {
    const png = await readFile(new URL(path, import.meta.url));
    assert.equal(png.readUInt32BE(16), expectedWidth, `${path} width`);
    assert.equal(png.readUInt32BE(20), expectedHeight, `${path} height`);
  }
});
