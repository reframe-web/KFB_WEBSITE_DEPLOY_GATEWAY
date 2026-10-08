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
if (!Array.isArray(legacyFeed.items)) throw new Error("Public legacy feed is invalid.");
const permittedLegacy = new Set();
for (const item of legacyFeed.items) {
  if (item.status !== "published" || item.privacy !== "public_safe" ||
      !/^[A-Za-z0-9._-]+$/u.test(item.id ?? "") || permittedLegacy.has(item.id)) {
    throw new Error("Unapproved or duplicate item in public legacy feed.");
  }
  permittedLegacy.add(item.id);
  for (const lang of ["ja", "en"]) {
    const rel = join(root, lang, "activities", "archive", item.id, "index.html");
    if (!(await exists(rel))) throw new Error("Approved legacy article missing " + item.id);
  }
}
for (const lang of ["ja", "en"]) {
  const archive = join(root, lang, "activities", "archive");
  if (await exists(archive)) {
    for (const id of await readdir(archive)) {
      if (!permittedLegacy.has(id)) throw new Error("Unapproved legacy article exposed: " + id);
    }
  }
}
const mediaRoot = join(root, "assets", "legacy");
if (await exists(mediaRoot)) {
  for (const id of await readdir(mediaRoot)) {
    if (!permittedLegacy.has(id)) throw new Error("Unapproved legacy photo exposed: " + id);
  }
}

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
const releaseRequiresLiveStripe = process.argv.includes("--require-live-stripe");
const checkoutLinks = (html) =>
  [...html.matchAll(/href=["'](https:\/\/(?:donate|buy)\.stripe\.com\/[^"']+)["']/giu)].map((m) => m[1]);
const jaCheckout = checkoutLinks(jaSupport);
const enCheckout = checkoutLinks(enSupport);
const hasTestCheckout = [...jaCheckout, ...enCheckout].some((url) => /\/test_/iu.test(url));
if (hasTestCheckout) throw new Error("Sandbox Stripe checkout must not exist in public snapshots.");
if (jaCheckout.length === 0 && enCheckout.length === 0) {
  if (releaseRequiresLiveStripe) throw new Error("Live Stripe checkout is not ready: refusing general-public deployment.");
  if (!jaSupport.includes("カード寄付は現在準備中") || !enSupport.includes("Card giving is currently being prepared")) {
    throw new Error("Card donation readiness copy missing.");
  }
} else {
  if (jaCheckout.length !== 8 || enCheckout.length !== 8 ||
      new Set(jaCheckout).size !== 8 || JSON.stringify(jaCheckout) !== JSON.stringify(enCheckout)) {
    throw new Error("JA/EN live Stripe checkout mismatch or incomplete 8-plan configuration.");
  }
  if (jaSupport.includes("カード寄付は現在準備中") || enSupport.includes("Card giving is currently being prepared")) {
    throw new Error("Live Stripe checkout must not display a coming-soon notice.");
  }
}

const sitemap = await readFile(join(root, "sitemap.xml"), "utf8");
for (const url of [
  "https://kfbokinawa.org/","https://kfbokinawa.org/ja/","https://kfbokinawa.org/en/",
  "https://kfbokinawa.org/ja/activities/","https://kfbokinawa.org/en/activities/"
]) {
  if (!sitemap.includes(url)) throw new Error(`Sitemap missing: ${url}`);
}
if (/\/review\/|legacy-preview/iu.test(sitemap)) {
  throw new Error("Preview URL leaked into sitemap.");
}
for (const match of sitemap.matchAll(/https:\/\/kfbokinawa\.org\/(?:ja|en)\/activities\/archive\/(legacy-[A-Za-z0-9._-]+)\//gu)) {
  if (!permittedLegacy.has(match[1])) throw new Error("Unapproved archive URL in sitemap: " + match[1]);
}

console.log(`KFB production validation passed: ${htmlFiles.length} HTML documents, ${index.items.length} public-safe feed items.`);
