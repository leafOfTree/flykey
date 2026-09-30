import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(resolve(projectRoot, "manifest.json"), "utf8"));
const releaseDirectory = resolve(projectRoot, "release");
const outputPath = resolve(releaseDirectory, `flykey-${manifest.version}.zip`);

await mkdir(releaseDirectory, { recursive: true });

const includedFiles = [
  "manifest.json",
  "common/messages.js",
  "common/site-settings.js",
  "common/worker.js",
  "frontend/dist/index.js",
  "help/index.html",
  "help/help.css",
  "popup/index.html",
  "popup/popup.css",
  "popup/popup.js",
  ...[16, 32, 48, 128].map((size) => `icon/${size}.png`),
];
const files = Object.fromEntries(await Promise.all(includedFiles.map(async (path) => [
  path,
  new Uint8Array(await readFile(resolve(projectRoot, path))),
])));
const archive = zipSync(files, { level: 9 });

await writeFile(outputPath, archive);
console.log(`Created ${outputPath} (${archive.byteLength} bytes)`);
