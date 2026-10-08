import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

const rootArg = process.argv[2];
if (!rootArg) throw new Error("Usage: node gateway/build-production.mjs <snapshot-directory>");
const root = resolve(rootArg);

const pathInRoot = (...parts) => {
  const p = resolve(root, ...parts);
  if (p !== root && !p.startsWith(root + sep)) throw new Error("Path escaped production snapshot.");
  return p;
};

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

function replaceSectionContaining(html, needle, replacement) {
  const needleIndex = html.indexOf(needle);
  if (needleIndex < 0) return html;
  let start = -1;
  for (const match of html.matchAll(/<section\\b[^>]*>/giu)) {
    if (match.index > needleIndex) break;
    start = match.index;
  }
  const end = html.indexOf("</section>", needleIndex);
  if (start < 0 || end < 0) throw new Error(`Could not isolate section containing: ${needle}`);
  return html.slice(0, start) + replacement + html.slice(end + "</section>".length);
}

function transformHtml(html, rel) {
  let out = html;

  out = out.replace(
    /<meta\s+name=["']robots["']\s+content=["']noindex,nofollow,noarchive["']\s*\/?>(?!\s*<meta\s+name=["']robots)/giu,
    '<meta name="robots" content="index,follow">'
  );

  out = out.replaceAll("kfokinawa@gmail.com", "info@kfbokinawa.org");
  out = out.replaceAll("Private pre-release preview", "");
  out = out.replaceAll("公開前プレビュー：検索エンジン非公開", "");
  out = out.replaceAll("公開前プレビュー", "");
  out = out.replaceAll("Stripe導入設計", "カード寄付は準備中");

  out = out.replaceAll(
    "日々の活動と、年度ごとの活動・会計情報を一つの流れで確認できるサイトを目指しています。確認できた資料から順に整理します。",
    "日々の活動と、年度ごとの活動・会計情報を一つの流れでご覧いただけます。"
  );
  out = out.replaceAll(
    "「種類」は記事の役割、「テーマ」は記事の内容を表します。新しい記事を追加すると、この一覧とTOPの新着が同じ正本から更新されます。",
    "記事の種類やテーマで絞り込んでご覧いただけます。"
  );
  out = out.replaceAll(
    "旧サイト・保存済み資産にある原本を確認しながら、年度別に整理しています。数値は原資料からのみ掲載します。",
    "KFBの年次活動・会計情報を年度別にご覧いただけます。"
  );
  out = out.replaceAll("会計画像確認中", "活動記録");
  out = out.replaceAll("会計数値確認済み", "活動・会計記録");
  out = out.replaceAll("原本確認済み", "活動・会計記録");
  out = out.replaceAll(
    "会計数値は保存済みの公式原本から確認できたものだけを掲載しています。2024年度の会計表は画像原本を再確認中です。",
    "年度ごとの活動・会計情報をご覧いただけます。"
  );
  out = out.replaceAll(
    "Saved records from the previous websites are being checked and organized by year. Figures will be published only from source documents.",
    "KFB annual activity and financial records are organized by fiscal year."
  );
  out = out.replaceAll("Financial image under review", "Annual record");
  out = out.replaceAll("Financial figures verified", "Annual & financial record");
  out = out.replaceAll("Source verified", "Annual record");
  out = out.replaceAll(
    "Financial figures are published only when confirmed in archived official source records. FY2024 accounting-table images are still being re-verified.",
    "Annual activity and financial records are available by fiscal year."
  );
  out = out.replaceAll(
    "Current details below are based on KFB’s verified official information.",
    "Organization information for Kodomo Food Bank KFB."
  );

  if (rel === "ja/support/index.html") {
    const section = '<section class="section"><div class="shell"><div class="section-head"><div><div class="kicker">Card Support</div><h2>カードで支援する</h2></div><p>カード寄付は現在準備中です。利用開始後、このページでご案内します。</p></div><div class="info-card"><h3>現在ご利用いただける支援方法</h3><p>銀行振込をご利用いただけます。企業・団体からのご支援やボランティアについてもお問い合わせください。</p></div></div></section>';
    out = replaceSectionContaining(out, '<div class="kicker">Card Support</div>', section);
    out = out.replace(
      /<p class="bank-note">[\s\S]*?<\/p>/u,
      '<p class="bank-note">※振込手数料はご利用の金融機関により異なります。</p>'
    );
  }

  if (rel === "en/support/index.html") {
    const section = '<section class="section"><div class="shell"><div class="section-head"><div><div class="kicker">Card Support</div><h2>Support by card</h2></div><p>Card giving is currently being prepared. This page will be updated when card donations become available.</p></div><div class="info-card"><h3>Ways to support KFB now</h3><p>Domestic bank transfer is currently available. Companies, organizations and prospective volunteers are also welcome to contact KFB.</p></div></div></section>';
    out = replaceSectionContaining(out, '<div class="kicker">Card Support</div>', section);
    out = out.replace(
      /<p class="bank-note">[\s\S]*?<\/p>/u,
      '<p class="bank-note">Bank-transfer fees, if any, depend on your bank.</p>'
    );
    out = out.replaceAll(
      "KFB’s work is supported by donations and community cooperation. The new site is being prepared for simple card giving through Stripe while retaining bank transfer options.",
      "KFB’s work is supported by donations and community cooperation. Domestic bank transfer is currently available, and card giving will be added after payment setup is complete."
    );
  }

  return out;
}

// Fail-closed release gate: public source archives alone do not establish permission.
const legacySourcePath = pathInRoot("data", "legacy-preview.json");
const legacyFeedPath = pathInRoot("data", "legacy-feed.json");
const legacySource = JSON.parse(await readFile(legacySourcePath, "utf8"));
const legacyCandidateFeed = JSON.parse(await readFile(legacyFeedPath, "utf8"));
if (!Array.isArray(legacySource.items) || !Array.isArray(legacyCandidateFeed.items)) {
  throw new Error("Legacy source/feed items arrays are required for release.");
}
const releaseEligible = (item) => Boolean(
  item && item.represented_by_existing !== true &&
  item.status === "published" && item.privacy === "public_safe" &&
  item.source_public_verified === true && item.client_approved === true &&
  item.media_approved === true && item.translation_approved === true &&
  typeof item.approval_reference === "string" && item.approval_reference.trim().length > 0
);
const eligible = new Map();
const seen = new Set();
for (const item of legacySource.items) {
  if (!item.id || !/^[A-Za-z0-9._-]+$/u.test(item.id) || seen.has(item.id)) {
    throw new Error("Legacy release includes duplicate or unsafe ID.");
  }
  seen.add(item.id);
  if (releaseEligible(item)) eligible.set(item.id, item);
  else {
    for (const lang of ["ja", "en"]) {
      await rm(pathInRoot(lang, "activities", "archive", item.id), { recursive: true, force: true });
    }
    // Individual source photos also stay private when their article is not approved.
    await rm(pathInRoot("assets", "legacy", item.id), { recursive: true, force: true });
  }
}
const publicItems = legacyCandidateFeed.items.filter((item) => eligible.has(item.id)).map((item) => {
  const safe = structuredClone(item);
  safe.status = "published";
  safe.privacy = "public_safe";
  for (const key of ["preview_legacy","review_status","client_approved","media_approved",
    "translation_approved","approval_reference","source_public_evidence"]) delete safe[key];
  return safe;
});
if (publicItems.length !== eligible.size) {
  throw new Error("Approved legacy items missing or duplicated in legacy feed.");
}
for (const parts of [
  ["data", "legacy-preview.json"], ["data", "legacy-media-bundles"], ["ja", "review"], ["en", "review"],
  ["ja", "activities", "legacy"], ["en", "activities", "legacy"],
]) await rm(pathInRoot(...parts), { recursive: true, force: true });
const publicLegacyFeed = {
  schema: "kfb-public-feed-v1",
  purpose: "Individually source-verified and client-approved historical articles.",
  items: publicItems,
};
await mkdir(pathInRoot("data"), { recursive: true });
await writeFile(legacyFeedPath, JSON.stringify(publicLegacyFeed), "utf8");
console.log("Legacy publication gate: " + eligible.size + " client-approved, " +
  (legacySource.items.length - eligible.size) + " withheld.");

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
  await writeFile(file, transformHtml(body, rel), "utf8");
}

await writeFile(
  pathInRoot("robots.txt"),
  "User-agent: *\nAllow: /\nSitemap: https://kfbokinawa.org/sitemap.xml\n",
  "utf8"
);

const canonicalUrls = new Set();
for (const file of htmlFiles) {
  if (!(await exists(file))) continue;
  const body = await readFile(file, "utf8");
  if (/name=["']robots["'][^>]*content=["'][^"']*noindex/iu.test(body)) continue;
  const match = body.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/iu);
  if (!match) continue;
  const url = match[1];
  if (!url.startsWith("https://kfbokinawa.org/")) throw new Error(`Unexpected canonical origin in ${file}: ${url}`);
  canonicalUrls.add(url);
}

const xmlEscape = (s) => s.replace(/[&<>"']/gu, (ch) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[ch]);
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  [...canonicalUrls].sort().map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`).join("\n") +
  '\n</urlset>\n';
await writeFile(pathInRoot("sitemap.xml"), sitemap, "utf8");

console.log(`Prepared public KFB snapshot: ${htmlFiles.length} HTML files, ${canonicalUrls.size} sitemap URLs. Unreviewed legacy preview content excluded.`);
