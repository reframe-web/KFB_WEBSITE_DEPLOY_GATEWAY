import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const rootArg = process.argv[2];
if (!rootArg) throw new Error("Usage: node gateway/verify-production.mjs <snapshot-directory>");
const root = resolve(rootArg);

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

const required = [
  "index.html","ja/index.html","en/index.html",
  "ja/about/index.html","en/about/index.html",
  "ja/what-we-do/index.html","en/what-we-do/index.html",
  "ja/activities/index.html","en/activities/index.html",
  "ja/support/index.html","en/support/index.html",
  "ja/contact/index.html","en/contact/index.html",
  "data/content-index.json","data/legacy-feed.json","robots.txt","sitemap.xml",
];

for (const rel of required) {
  if (!(await exists(join(root, ...rel.split("/"))))) throw new Error(`Production file missing: ${rel}`);
}

for (const rel of [
  "data/legacy-preview.json","ja/review","en/review",
  "ja/activities/legacy","en/activities/legacy"
]) {
  if (await exists(join(root, ...rel.split("/")))) throw new Error(`Preview-only path remains: ${rel}`);
}

const robots = await readFile(join(root, "robots.txt"), "utf8");
if (!/Allow:\s*\//u.test(robots) || /Disallow:\s*\//u.test(robots)) throw new Error("robots.txt is not public.");
if (!robots.includes("https://kfbokinawa.org/sitemap.xml")) throw new Error("Production sitemap is not advertised.");

const legacyFeed = JSON.parse(await readFile(join(root, "data", "legacy-feed.json"), "utf8"));
if (!Array.isArray(legacyFeed.items) || legacyFeed.items.length !== 0) throw new Error("Public legacy feed is not empty.");

const index = JSON.parse(await readFile(join(root, "data", "content-index.json"), "utf8"));
if (index.schema !== 1 || !Array.isArray(index.items)) throw new Error("Invalid content index.");
for (const item of index.items) {
  if (item.status !== "published" || item.privacy !== "public_safe") {
    throw new Error(`Unsafe public item: ${item.id}`);
  }
}

const forbidden = [
  /noindex\s*,?\s*nofollow/iu,
  /Private pre-release preview/iu,
  /公開前プレビュー/iu,
  /Private preview:/iu,
  /Stripe接続後に利用可能/iu,
  /移行元の寄付チケット/iu,
  /旧サイト・保存済み資産/iu,
  /原本確認済み/iu,
  /会計画像確認中/iu,
  /同じ正本から更新/iu,
  /kfokinawa@gmail\.com/iu,
];

const htmlFiles = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile() && /\.html?$/iu.test(entry.name)) htmlFiles.push(full);
  }
}
await walk(root);

for (const file of htmlFiles) {
  const rel = relative(root, file).split(sep).join("/");
  const body = await readFile(file, "utf8");
  if (!/<meta\s+name=["']robots["']\s+content=["']index,follow["']/iu.test(body)) {
    throw new Error(`Public robots meta missing in ${rel}`);
  }
  for (const re of forbidden) {
    if (re.test(body)) throw new Error(`Preview/internal copy remains in ${rel}`);
  }
  const canonical = body.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/iu)?.[1];
  if (!canonical?.startsWith("https://kfbokinawa.org/")) throw new Error(`Invalid canonical in ${rel}`);
}

for (const rel of ["ja/contact/index.html","en/contact/index.html"]) {
  const body = await readFile(join(root, ...rel.split("/")), "utf8");
  if (!body.includes("info@kfbokinawa.org")) throw new Error(`Domain contact email missing: ${rel}`);
}

const jaSupport = await readFile(join(root, "ja", "support", "index.html"), "utf8");
const enSupport = await readFile(join(root, "en", "support", "index.html"), "utf8");
if (!jaSupport.includes("銀行振込") || !enSupport.includes("Bank Transfer")) throw new Error("Bank transfer section missing.");
if (!jaSupport.includes("カード寄付は現在準備中") || !enSupport.includes("Card giving is currently being prepared")) {
  throw new Error("Card donation readiness copy missing.");
}

const sitemap = await readFile(join(root, "sitemap.xml"), "utf8");
for (const url of [
  "https://kfbokinawa.org/","https://kfbokinawa.org/ja/","https://kfbokinawa.org/en/",
  "https://kfbokinawa.org/ja/activities/","https://kfbokinawa.org/en/activities/"
]) {
  if (!sitemap.includes(url)) throw new Error(`Sitemap missing: ${url}`);
}
if (/\/review\/|\/activities\/archive\/legacy-|legacy-preview/iu.test(sitemap)) {
  throw new Error("Preview URL leaked into sitemap.");
}

console.log(`KFB production validation passed: ${htmlFiles.length} HTML documents, ${index.items.length} public-safe feed items.`);
