import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const rootArg = process.argv[2];
if (!rootArg) throw new Error("Usage: node gateway/build-legacy-pages.mjs <snapshot-directory>");
const root = resolve(rootArg);

const readJson = async (path) => {
  const text = await readFile(path, "utf8");
  return JSON.parse(text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text);
};

const esc = (value = "") => String(value).replace(/[&<>"']/gu, (ch) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[ch]);

const stripHtml = (value = "") => String(value)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
  .replace(/<[^>]+>/gu, " ")
  .replace(/\s+/gu, " ")
  .trim();

const sanitizeArchiveHtml = (value = "") => String(value)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, "")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, "")
  .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/giu, "")
  .replace(/(href|src)\s*=\s*("|')\s*javascript:[\s\S]*?\2/giu, '$1="#"');

const typeLabel = {
  ja: {
    activity_report: "活動報告",
    youtube_report: "YouTube活動報告",
    news: "お知らせ",
    event: "イベント",
    blog: "ブログ",
  },
  en: {
    activity_report: "Activity report",
    youtube_report: "YouTube activity report",
    news: "News",
    event: "Event",
    blog: "Blog",
  },
};

function dateText(date, lang) {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat(lang === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: lang === "ja" ? "2-digit" : "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function pageHtml(item, lang) {
  const isEn = lang === "en";
  const title = isEn ? item.title_en : item.title_ja;
  const excerpt = isEn ? item.excerpt_en : item.excerpt_ja;
  const bodyRaw = isEn ? item.body_en : item.body_html;
  const body = sanitizeArchiveHtml(bodyRaw || "");
  const url = item[`url_${lang}`];
  const otherLang = isEn ? "ja" : "en";
  const altUrl = item[`url_${otherLang}`];
  const canonical = `https://kfbokinawa.org${url}`;
  const alternate = `https://kfbokinawa.org${altUrl}`;
  const publicSafe = item.status === "published" && item.privacy === "public_safe";
  const robots = publicSafe ? "index,follow" : "noindex,nofollow,noarchive";
  const description = stripHtml(excerpt || bodyRaw || title).slice(0, 155);
  const date = dateText(item.published_at, lang);
  const label = typeLabel[lang][item.type] || (isEn ? "Archive" : "活動記録");
  const langName = isEn ? "日本語" : "English";
  const brandName = isEn ? "Kodomo Food Bank KFB" : "子どもフードバンクKFB";
  const nav = isEn
    ? '<a href="/en/about/">About KFB</a><a href="/en/what-we-do/">What We Do</a><a href="/en/activities/" aria-current="page">Impact & Reports</a><a class="support-link" href="/en/support/">Support Us</a><a href="/en/contact/">Contact</a>'
    : '<a href="/ja/about/">KFBについて</a><a href="/ja/what-we-do/">活動内容</a><a href="/ja/activities/" aria-current="page">活動・実績</a><a class="support-link" href="/ja/support/">支援する</a><a href="/ja/contact/">お問い合わせ</a>';
  const home = isEn ? "Home" : "ホーム";
  const reports = isEn ? "Impact & Reports" : "活動・実績";
  const loadingFallback = isEn
    ? "The preserved source does not contain usable body text."
    : "保存原本から利用できる本文を確認できませんでした。";
  const archiveNote = isEn
    ? '<div class="legacy-language-note"><strong>English archive translation</strong><br>This page is an English translation of a KFB activity record originally published in Japanese. It remains part of the protected migration review until its final publication status is confirmed.</div>'
    : '<div class="legacy-language-note"><strong>旧サイト移行記録</strong><br>このページは旧サイトから保全した活動記録です。最終的な公開可否は移行レビューで確認します。</div>';
  const sourceBox = item.source_url
    ? `<div class="legacy-source"><strong>${isEn ? "Original legacy page" : "旧サイト原文"}</strong><p>${isEn ? "Open the source page preserved from the previous website." : "移行内容との照合用に、旧サイト側の原文も確認できます。"}</p><a href="${esc(item.source_url)}" target="_blank" rel="noopener">${isEn ? "Open original page ↗" : "元ページを開く ↗"}</a></div>`
    : "";
  const ld = publicSafe ? `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": item.type === "news" ? "NewsArticle" : "Article",
    headline: title,
    datePublished: item.published_at || undefined,
    inLanguage: lang,
    mainEntityOfPage: canonical,
    publisher: { "@type": "Organization", name: "Kodomo Food Bank KFB" },
  }).replace(/</gu, "\\u003c")}</script>` : "";

  return `<!doctype html>
<html lang="${lang}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} | ${esc(brandName)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${esc(canonical)}">
<link rel="alternate" hreflang="${lang}" href="${esc(canonical)}">
<link rel="alternate" hreflang="${otherLang}" href="${esc(alternate)}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}">
<link rel="stylesheet" href="/assets/css/site.css"><link rel="stylesheet" href="/assets/css/site-v2.css"><link rel="stylesheet" href="/assets/css/site-v3.css"><link rel="stylesheet" href="/assets/css/site-v4.css">
<script defer src="/assets/js/site.js"></script>${ld}
<style>.legacy-article{width:min(920px,calc(100% - 32px));margin:auto}.legacy-hero{padding:44px 0 18px}.legacy-hero h1{font-size:clamp(2rem,5vw,3.5rem);line-height:1.15;margin:.35rem 0}.legacy-meta{display:flex;gap:10px;flex-wrap:wrap;color:#6d6257;margin-top:12px}.legacy-body{padding:20px 0 60px;font-size:1.05rem;line-height:1.9}.legacy-body img{display:block;max-width:100%;height:auto;margin:22px auto;border-radius:16px}.legacy-body table{width:100%;border-collapse:collapse;display:block;overflow:auto;margin:22px 0}.legacy-body td,.legacy-body th{border:1px solid #d9d2c8;padding:9px;min-width:120px}.legacy-body blockquote{border-left:4px solid #c8aa7a;padding-left:16px;margin-left:0}.legacy-source{margin:36px 0;padding:18px;border-radius:16px;background:#f7f3ed}.legacy-source a{word-break:break-all}</style>
</head><body>
<a class="skip-link" href="#main">${isEn ? "Skip to content" : "本文へ移動"}</a>
<header class="site-header"><div class="shell header-inner"><a class="brand" href="/${lang}/"><img class="brand-logo" src="/assets/images/kfb-mark.webp" width="300" height="300" alt=""><span class="brand-name">${esc(brandName)}</span></a><button class="menu-toggle" type="button" data-menu-toggle aria-expanded="false" aria-controls="primary-nav" aria-label="${isEn ? "Open menu" : "メニューを開く"}">☰</button><nav class="nav" id="primary-nav" data-nav>${nav}<a class="nav-lang" href="${esc(altUrl)}">${langName}</a></nav></div></header>
<main id="main"><article class="legacy-article"><div class="legacy-hero"><nav class="breadcrumb"><a href="/${lang}/">${home}</a><span>/</span><a href="/${lang}/activities/">${reports}</a><span>/</span><span>${isEn ? "Archive" : "活動記録"}</span></nav><div class="eyebrow">${esc(label)}</div><h1>${esc(title)}</h1><div class="legacy-meta">${date ? `<time datetime="${esc(item.published_at)}">${esc(date)}</time>` : ""}<span>${isEn ? "KFB legacy archive" : "旧サイト移行記事"}</span></div></div>
${archiveNote}
<div class="legacy-body">${body || `<p>${loadingFallback}</p>`}</div>
${sourceBox}
</article></main>
<footer class="footer"><div class="shell"><div class="footer-grid"><div><a class="brand" href="/${lang}/"><img class="brand-logo" src="/assets/images/kfb-mark.webp" width="300" height="300" alt=""><span class="brand-name">${esc(brandName)}</span></a><p>${isEn ? "Supporting children and families in Okinawa, Japan." : "沖縄で子どもと家庭を支える活動を行っています。"}</p></div><div class="footer-links"><strong>${isEn ? "Site" : "サイト"}</strong><a href="/${lang}/about/">${isEn ? "About KFB" : "KFBについて"}</a><a href="/${lang}/what-we-do/">${isEn ? "What We Do" : "活動内容"}</a><a href="/${lang}/activities/">${reports}</a><a href="/${lang}/support/">${isEn ? "Support Us" : "支援する"}</a></div><div class="footer-links"><strong>${isEn ? "Information" : "情報"}</strong><a href="/${lang}/contact/">${isEn ? "Contact" : "お問い合わせ"}</a><a href="${esc(altUrl)}">${langName}</a></div></div><div class="footer-bottom"><small>© Kodomo Food Bank KFB</small><small>${isEn ? "Private pre-release preview" : "公開前プレビュー"}</small></div></div></footer>
</body></html>`;
}

const legacyPath = join(root, "data", "legacy-preview.json");
const legacy = await readJson(legacyPath);
if (!legacy || !Array.isArray(legacy.items)) throw new Error("legacy-preview.json must contain an items array.");

let generated = 0;
for (const item of legacy.items) {
  if (item.represented_by_existing) continue;
  if (!item.id || !/^[A-Za-z0-9._-]+$/u.test(item.id)) throw new Error(`Unsafe legacy item id: ${item.id ?? "(missing)"}`);
  if (!item.title_ja || !item.title_en || !item.excerpt_en || !item.url_ja || !item.url_en) {
    throw new Error(`Legacy item is missing bilingual page data: ${item.id}`);
  }
  if (item.body_html && !item.body_en) throw new Error(`Legacy item has Japanese body but no English translation: ${item.id}`);

  for (const lang of ["ja", "en"]) {
    const expected = `/${lang}/activities/archive/${item.id}/`;
    if (item[`url_${lang}`] !== expected) {
      throw new Error(`Legacy ${lang} URL must be ${expected}: ${item.id}`);
    }
    const dir = join(root, lang, "activities", "archive", item.id);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "index.html"), pageHtml(item, lang), "utf8");
    generated += 1;
  }
}

console.log(`Generated ${generated} bilingual legacy archive HTML pages from Drive canonical data.`);
