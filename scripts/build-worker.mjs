import { readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const projectRoot = resolve(new URL("..", import.meta.url).pathname);
const sourceRoot = resolve(projectRoot, "static-assets");
const distRoot = resolve(projectRoot, "dist");

const files = [
  ["/index.html", "text/html; charset=utf-8"],
  ["/cloud.html", "text/html; charset=utf-8"],
  ["/xlsx.full.min.js", "application/javascript; charset=utf-8"],
  ["/supabase-config.js", "application/javascript; charset=utf-8"],
  ["/校徽背景.png", "image/png"],
  ["/version.json", "application/json; charset=utf-8"],
];

const entries = [];
for (const [pathname, contentType] of files) {
  const bytes = await readFile(resolve(sourceRoot, pathname.slice(1)));
  entries.push(`  ${JSON.stringify(pathname)}: { type: ${JSON.stringify(contentType)}, body: ${JSON.stringify(bytes.toString("base64"))} }`);
}

const worker = `const assets = {\n${entries.join(",\n")}\n};\n\nfunction decodeBase64(value) {\n  const binary = atob(value);\n  const bytes = new Uint8Array(binary.length);\n  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);\n  return bytes;\n}\n\nexport default {\n  async fetch(request, env, ctx) {\n    void env;\n    void ctx;\n\n    let pathname;\n    try {\n      pathname = decodeURIComponent(new URL(request.url).pathname);\n    } catch {\n      return new Response("Bad request", { status: 400 });\n    }\n    if (pathname === "/") pathname = "/index.html";\n\n    const asset = assets[pathname];\n    if (!asset) return new Response("Not found", { status: 404 });\n\n    return new Response(decodeBase64(asset.body), {\n      headers: {\n        "content-type": asset.type,\n        "cache-control": "no-cache",\n      },\n    });\n  },\n};\n`;

await rm(distRoot, { recursive: true, force: true });
await mkdir(resolve(distRoot, "server"), { recursive: true });
await mkdir(resolve(distRoot, ".openai"), { recursive: true });
await writeFile(resolve(distRoot, "server/index.js"), worker);
await writeFile(resolve(distRoot, ".openai/hosting.json"), await readFile(resolve(projectRoot, ".openai/hosting.json"), "utf8"));
console.log(`Built Worker with ${files.length} preserved static assets`);
