import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const distRoot = resolve(projectRoot, "dist");
const sourceFiles = [
  ["/index.html", "text/html; charset=utf-8", "index.html"],
  ["/cloud.html", "text/html; charset=utf-8", "cloud.html"],
  ["/xlsx.full.min.js", "application/javascript; charset=utf-8", "xlsx.full.min.js"],
  ["/d1-cloud.js", "application/javascript; charset=utf-8", "d1-cloud.js"],
  ["/校徽背景.png", "image/png", "校徽背景.png"],
  ["/version.json", "application/json; charset=utf-8", "version.json"],
];

const entries = [];
for (const [pathname, contentType, filename] of sourceFiles) {
  const bytes = await readFile(resolve(projectRoot, filename));
  entries.push(`  ${JSON.stringify(pathname)}: { type: ${JSON.stringify(contentType)}, body: ${JSON.stringify(bytes.toString("base64"))} }`);
}
const workerSource = await readFile(resolve(projectRoot, "worker/index.js"), "utf8");
if (!workerSource.includes("__ASSETS__")) throw new Error("worker/index.js missing __ASSETS__ marker");
const assetText = entries.join(",\n");
const worker = workerSource.replace("__ASSETS__", "{\n" + assetText + "\n}");

await rm(distRoot, { recursive: true, force: true });
await mkdir(resolve(distRoot, "server"), { recursive: true });
await mkdir(resolve(distRoot, ".openai"), { recursive: true });
await writeFile(resolve(distRoot, "server/index.js"), worker);
await writeFile(resolve(distRoot, "index.html"), await readFile(resolve(projectRoot, "index.html")));
await writeFile(resolve(distRoot, ".openai/hosting.json"), await readFile(resolve(projectRoot, ".openai/hosting.json"), "utf8"));
console.log(`Built D1 Worker with ${sourceFiles.length} static assets`);
