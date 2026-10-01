function constantTimeEqual(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let i = 0; i < length; i += 1) {
    mismatch |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

const PUBLIC_HOST = "kfbokinawa.org";
const WWW_HOST = "www.kfbokinawa.org";
const PREVIEW_HOST = "kfb-preview.hungrypriest1224.workers.dev";
const PUBLIC_CONTENT_FEED_SCRIPT = "(function publicFeedFactory() {\n  const DATA_URL = \"/data/content-index.json\";\n  const lang = document.documentElement.lang?.toLowerCase().startsWith(\"en\") ? \"en\" : \"ja\";\n  const INITIAL_BATCH = 12;\n  const BATCH_SIZE = 12;\n\n  const esc = (value = \"\") => String(value).replace(/[&<>\"']/g, (ch) => ({\n    \"&\": \"&amp;\", \"<\": \"&lt;\", \">\": \"&gt;\", '\"': \"&quot;\", \"'\": \"&#39;\"\n  })[ch]);\n\n  const itemDate = (item) => item.published_at ? Date.parse(item.published_at + \"T00:00:00Z\") : -Infinity;\n  const sortItems = (items) => [...items].sort((a, b) => itemDate(b) - itemDate(a) || String(a.id).localeCompare(String(b.id)));\n  const local = (item, field) => item[field + \"_\" + lang] || item[field + \"_ja\"] || \"\";\n  const urlFor = (item) => item[\"url_\" + lang] || item.url_ja || \"#\";\n\n  const formatDate = (date) => {\n    if (!date) return \"\";\n    const d = new Date(date + \"T00:00:00Z\");\n    if (Number.isNaN(d.getTime())) return \"\";\n    return new Intl.DateTimeFormat(lang === \"ja\" ? \"ja-JP\" : \"en-US\", {\n      year: \"numeric\", month: lang === \"ja\" ? \"2-digit\" : \"short\", day: \"2-digit\", timeZone: \"UTC\"\n    }).format(d);\n  };\n\n  const mediaHtml = (item) => {\n    const image = item.image || {};\n    const alt = lang === \"en\" ? (image.alt_en || image.alt_ja || \"\") : (image.alt_ja || \"\");\n    if (image.brand) {\n      return `<div class=\"activity-card-media activity-card-media-placeholder\"><img class=\"activity-placeholder-image\" src=\"/assets/images/kfb-article-placeholder.webp\" width=\"1280\" height=\"800\" loading=\"lazy\" decoding=\"async\" alt=\"\"><span class=\"activity-media-label\">${esc(lang === \"ja\" ? \"KFB更新情報\" : \"KFB update\")}</span></div>`;\n    }\n    const src = image.src || \"/assets/images/kfb-article-placeholder.webp\";\n    const webp = image.webp ? `<source srcset=\"${esc(image.webp)}\" type=\"image/webp\">` : \"\";\n    return `<div class=\"activity-card-media\"><picture>${webp}<img src=\"${esc(src)}\" width=\"960\" height=\"720\" loading=\"lazy\" decoding=\"async\" alt=\"${esc(alt)}\"></picture><span class=\"activity-media-label\">${esc(lang === \"ja\" ? \"KFB更新情報\" : \"KFB update\")}</span></div>`;\n  };\n\n  const cardHtml = (item, data) => {\n    const typeLabel = data.types?.[item.type]?.[lang] || data.types?.[item.type]?.ja || item.type || \"\";\n    const dateText = formatDate(item.published_at);\n    const tagLabels = (item.tags || []).map((tag) => data.tags?.[tag]?.[lang] || data.tags?.[tag]?.ja).filter(Boolean);\n    const tags = tagLabels.slice(0, 2).map((tag) => `<span class=\"tag\">${esc(tag)}</span>`).join(\"\");\n    const date = dateText ? `<time datetime=\"${esc(item.published_at)}\">${esc(dateText)}</time>` : \"\";\n    return `<a class=\"activity-card\" href=\"${esc(urlFor(item))}\" data-content-type=\"${esc(item.type)}\" data-content-tags=\"${esc((item.tags || []).join(\" \"))}\">\n      ${mediaHtml(item)}\n      <div class=\"activity-card-body\">\n        <div class=\"meta-row\">${date}<span class=\"tag feed-type-tag\">${esc(typeLabel)}</span>${tags}</div>\n        <h3>${esc(local(item, \"title\"))}</h3>\n        <p>${esc(local(item, \"excerpt\"))}</p>\n        <span class=\"activity-card-link\">${esc(lang === \"ja\" ? \"続きを読む →\" : \"Read more →\")}</span>\n      </div>\n    </a>`;\n  };\n\n  const renderLatest = (data) => {\n    const items = sortItems((data.items || []).filter((item) => item.published_at));\n    document.querySelectorAll(\"[data-kfb-latest]\").forEach((container) => {\n      const limit = Number(container.dataset.kfbLatest || 3);\n      const latest = items.filter((item) => lang !== \"en\" || (item.title_en && item.url_en)).slice(0, limit);\n      if (latest.length) container.innerHTML = latest.map((item) => cardHtml(item, data)).join(\"\");\n    });\n  };\n\n  const renderFeed = (data) => {\n    document.querySelectorAll(\"[data-kfb-feed]\").forEach((section) => {\n      const list = section.querySelector(\"[data-kfb-feed-list]\");\n      const typeBar = section.querySelector(\"[data-kfb-type-filters]\");\n      const tagBar = section.querySelector(\"[data-kfb-tag-filters]\");\n      const count = section.querySelector(\"[data-kfb-feed-count]\");\n      const empty = section.querySelector(\"[data-kfb-feed-empty]\");\n      if (!list || !typeBar) return;\n\n      const allItems = sortItems(data.items || []);\n      let activeType = \"all\";\n      let activeTag = \"all\";\n      let filtered = [];\n      let shown = 0;\n\n      const typeOrder = data.type_order || Object.keys(data.types || {});\n      const typeCounts = Object.fromEntries(typeOrder.map((type) => [type, allItems.filter((item) => item.type === type).length]));\n      const tagCounts = {};\n      allItems.forEach((item) => (item.tags || []).forEach((tag) => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; }));\n\n      typeBar.innerHTML = [\n        `<button class=\"feed-chip is-active\" type=\"button\" data-feed-type=\"all\" aria-pressed=\"true\">${esc(lang === \"ja\" ? \"すべて\" : \"All\")} <span>${allItems.length}</span></button>`,\n        ...typeOrder.map((type) => {\n          const n = typeCounts[type] || 0;\n          const label = data.types?.[type]?.[lang] || data.types?.[type]?.ja || type;\n          return `<button class=\"feed-chip\" type=\"button\" data-feed-type=\"${esc(type)}\" aria-pressed=\"false\" ${n === 0 ? \"disabled\" : \"\"}>${esc(label)} <span>${n}</span></button>`;\n        })\n      ].join(\"\");\n\n      const tags = Object.keys(tagCounts).sort((a,b) => tagCounts[b] - tagCounts[a] || a.localeCompare(b));\n      if (tagBar) {\n        tagBar.innerHTML = [\n          `<button class=\"feed-tag-chip is-active\" type=\"button\" data-feed-tag=\"all\" aria-pressed=\"true\">${esc(lang === \"ja\" ? \"全テーマ\" : \"All topics\")}</button>`,\n          ...tags.map((tag) => `<button class=\"feed-tag-chip\" type=\"button\" data-feed-tag=\"${esc(tag)}\" aria-pressed=\"false\">${esc(data.tags?.[tag]?.[lang] || data.tags?.[tag]?.ja || tag)} <span>${tagCounts[tag]}</span></button>`)\n        ].join(\"\");\n      }\n\n      const controls = document.createElement(\"div\");\n      controls.className = \"feed-loadmore\";\n      controls.innerHTML = `<button class=\"btn feed-loadmore-button\" type=\"button\" data-kfb-load-more>${esc(lang === \"ja\" ? \"さらに表示\" : \"Load more\")}</button><span class=\"feed-progress\" data-kfb-feed-progress aria-live=\"polite\"></span><span class=\"feed-sentinel\" data-kfb-feed-sentinel aria-hidden=\"true\"></span>`;\n      list.insertAdjacentElement(\"afterend\", controls);\n      const loadButton = controls.querySelector(\"[data-kfb-load-more]\");\n      const progress = controls.querySelector(\"[data-kfb-feed-progress]\");\n      const sentinel = controls.querySelector(\"[data-kfb-feed-sentinel]\");\n\n      const updateStatus = () => {\n        const total = filtered.length;\n        const visibleNow = Math.min(shown, total);\n        if (count) count.textContent = lang === \"ja\" ? `${visibleNow} / ${total}件表示` : `Showing ${visibleNow} of ${total}`;\n        if (progress) progress.textContent = total === 0 ? \"\" : (lang === \"ja\" ? `${visibleNow}件を表示中` : `${visibleNow} items shown`);\n        if (empty) empty.hidden = total !== 0;\n        if (loadButton) loadButton.hidden = total === 0 || visibleNow >= total;\n        controls.classList.toggle(\"is-complete\", total > 0 && visibleNow >= total);\n      };\n\n      const appendNext = () => {\n        if (shown >= filtered.length) return;\n        const next = Math.min(shown + BATCH_SIZE, filtered.length);\n        list.insertAdjacentHTML(\"beforeend\", filtered.slice(shown, next).map((item) => cardHtml(item, data)).join(\"\"));\n        shown = next;\n        updateStatus();\n      };\n\n      const apply = () => {\n        filtered = allItems.filter((item) => {\n          const typeOk = activeType === \"all\" || item.type === activeType;\n          const tagOk = activeTag === \"all\" || (item.tags || []).includes(activeTag);\n          return typeOk && tagOk;\n        });\n        shown = Math.min(INITIAL_BATCH, filtered.length);\n        list.innerHTML = filtered.slice(0, shown).map((item) => cardHtml(item, data)).join(\"\");\n        updateStatus();\n      };\n\n      loadButton?.addEventListener(\"click\", appendNext);\n      if (\"IntersectionObserver\" in window && sentinel) {\n        const observer = new IntersectionObserver((entries) => {\n          if (entries.some((entry) => entry.isIntersecting)) appendNext();\n        }, { rootMargin: \"700px 0px\" });\n        observer.observe(sentinel);\n      }\n\n      typeBar.addEventListener(\"click\", (event) => {\n        const button = event.target.closest(\"[data-feed-type]\");\n        if (!button || button.disabled) return;\n        activeType = button.dataset.feedType || \"all\";\n        typeBar.querySelectorAll(\"[data-feed-type]\").forEach((b) => {\n          const on = b === button;\n          b.classList.toggle(\"is-active\", on);\n          b.setAttribute(\"aria-pressed\", String(on));\n        });\n        apply();\n      });\n\n      tagBar?.addEventListener(\"click\", (event) => {\n        const button = event.target.closest(\"[data-feed-tag]\");\n        if (!button) return;\n        activeTag = button.dataset.feedTag || \"all\";\n        tagBar.querySelectorAll(\"[data-feed-tag]\").forEach((b) => {\n          const on = b === button;\n          b.classList.toggle(\"is-active\", on);\n          b.setAttribute(\"aria-pressed\", String(on));\n        });\n        apply();\n      });\n\n      apply();\n    });\n  };\n\n  fetch(DATA_URL, { credentials: \"same-origin\", cache: \"no-cache\" })\n    .then((response) => {\n      if (!response.ok) throw new Error(\"update data unavailable\");\n      return response.json();\n    })\n    .then((data) => {\n      renderLatest(data);\n      renderFeed(data);\n      document.documentElement.dataset.contentFeed = \"ready\";\n    })\n    .catch(() => {\n      document.documentElement.dataset.contentFeed = \"fallback\";\n    });\n})();";

function securityHeaders(headers = new Headers()) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return headers;
}

function privacyHeaders(headers = new Headers()) {
  securityHeaders(headers);
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Pragma", "no-cache");
  return headers;
}

function publicHeaders(headers = new Headers(), contentType = "") {
  securityHeaders(headers);
  headers.delete("X-Robots-Tag");
  headers.delete("Pragma");
  if (/text\/html/iu.test(contentType)) {
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  } else {
    headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  }
  return headers;
}

function unauthorized() {
  const headers = privacyHeaders(new Headers());
  headers.set("WWW-Authenticate", 'Basic realm="KFB Private Preview", charset="UTF-8"');
  headers.set("Content-Type", "text/plain; charset=utf-8");
  return new Response("Authentication required.", { status: 401, headers });
}

function notFound() {
  const headers = publicHeaders(new Headers({ "Content-Type": "text/plain; charset=utf-8" }), "text/plain");
  headers.set("X-Robots-Tag", "noindex");
  return new Response("Not found.", { status: 404, headers });
}

function isPrivateOnlyPath(pathname) {
  if (/^\/data\/(?:legacy-preview|legacy-feed|public-release)\.json$/u.test(pathname)) return true;
  if (/^\/(?:ja|en)\/activities\/(?:archive|legacy)(?:\/|$)/u.test(pathname)) return true;
  if (/^\/(?:ja|en)\/activities\/(?:2018|2022|2023|2024)(?:\/|$)/u.test(pathname)) return true;
  if (/^\/(?:ja|en)\/review(?:\/|$)/u.test(pathname)) return true;
  return false;
}

function removeAnnualSection(html) {
  return html.replace(
    /<section class="section section-soft"><div class="shell"><div class="section-head"><div><div class="kicker">Annual &amp; Financial<\/div>[\s\S]*?<\/section>/iu,
    ""
  ).replace(
    /<section class="section section-soft"><div class="shell"><div class="section-head"><div><div class="kicker">Annual & Financial<\/div>[\s\S]*?<\/section>/iu,
    ""
  );
}

function addPrivacyLink(html, lang) {
  const marker = lang === "en" ? "<strong>Information</strong>" : "<strong>情報</strong>";
  const href = lang === "en" ? "/en/privacy/" : "/ja/privacy/";
  const label = lang === "en" ? "Privacy" : "プライバシー";
  if (html.includes(`href="${href}"`)) return html;
  const start = html.lastIndexOf(`<div class="footer-links">${marker}`);
  if (start < 0) return html;
  const end = html.indexOf("</div>", start);
  if (end < 0) return html;
  return html.slice(0, end) + `<a href="${href}">${label}</a>` + html.slice(end);
}

function publicizeHtml(input) {
  let html = String(input);

  html = html.replace(
    /<meta name="robots" content="noindex,nofollow,noarchive">/giu,
    '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">'
  );

  html = html
    .replaceAll("kfokinawa@gmail.com", "info@kfbokinawa.org")
    .replaceAll("公開前プレビュー：検索エンジン非公開", "")
    .replaceAll("公開前プレビュー", "")
    .replaceAll("Private pre-release preview", "")
    .replaceAll("Stripe導入設計", "カード寄付は準備中")
    .replaceAll("Stripe-ready design", "Card giving in preparation")
    .replaceAll("Stripe接続後に利用可能", "カード寄付は準備中です")
    .replaceAll("Available after Stripe setup", "Card giving is being prepared")
    .replace(
      "「種類」は記事の役割、「テーマ」は記事の内容を表します。新しい記事を追加すると、この一覧とTOPの新着が同じ正本から更新されます。",
      "記事の種類やテーマで絞り込んでご覧いただけます。"
    )
    .replace(
      "Type describes the role of a post; topic tags describe its subject. New posts update this feed and the home-page latest section from the same publication index.",
      "Use the type and topic filters to explore KFB updates."
    )
    .replace(
      "日々の活動と、年度ごとの活動・会計情報を一つの流れで確認できるサイトを目指しています。確認できた資料から順に整理します。",
      "日々の活動と、年度ごとの活動・会計情報を一つの流れでご覧いただけます。"
    )
    .replace(
      "We are migrating verified legacy reports without inventing missing figures.",
      "Explore KFB activity stories, annual records and financial information."
    )
    .replace(
      "公開前プレビューでは、現在の公式情報源で確認できた内容を掲載しています。",
      "KFBの団体情報をご案内します。"
    )
    .replace(
      "Current details below are based on KFB’s verified official information.",
      "Organization information for Kodomo Food Bank KFB."
    )
    .replace(
      "現在の公式情報では、KFBの活動は大きく「子どもの居場所・食事提供」と「ひとり親家庭などへの食料・物資支援」の二つの柱で紹介されています。",
      "KFBの活動は、大きく「子どもの居場所・食事提供」と「ひとり親家庭などへの食料・物資支援」の二つの柱で取り組んでいます。"
    )
    .replace(
      "新サイトではStripeで分かりやすく決済できる形を準備しています。",
      "カード寄付は現在準備中です。銀行振込は現在ご利用いただけます。"
    )
    .replace(
      "The new site is being prepared for simple card giving through Stripe while retaining bank transfer options.",
      "You can support KFB by bank transfer, partnership, volunteering, and—once available—card giving."
    )
    .replace(
      "The amounts below reflect KFB’s current support-ticket structure. Card checkout will be enabled only after KFB’s Stripe account and payment links are verified.",
      "Card giving is currently being prepared. Bank transfer is available now."
    )
    .replace(
      "Bank-transfer fees, if any, depend on your bank. Details will be reconfirmed before public launch.",
      "Bank-transfer fees, if any, depend on your bank."
    );

  if (/<html\s+lang="ja"/iu.test(html) && html.includes('support-plans')) {
    html = html.replace(
      /<div class="support-plans">[\s\S]*?<\/div>\s*<div class="preview-note">/iu,
      '<div class="info-card"><h3>現在ご利用いただける支援方法</h3><p>銀行振込をご利用いただけます。企業・団体からのご支援やボランティアについてもお問い合わせください。</p></div><div class="preview-note">'
    );
  } else if (/<html\s+lang="en"/iu.test(html) && html.includes('support-plans')) {
    html = html.replace(
      /<div class="support-plans">[\s\S]*?<\/div>\s*<div class="preview-note">/iu,
      '<div class="info-card"><h3>Ways to support KFB now</h3><p>Domestic bank transfer is currently available. Companies, organizations and prospective volunteers are also welcome to contact KFB.</p></div><div class="preview-note">'
    );
  }

  html = html.replace(
    /<div class="preview-note"><strong>現在は非公開プレビューです。<\/strong>[\s\S]*?<\/div>/giu,
    '<div class="preview-note"><strong>カード寄付は現在準備中です。</strong> 現在は銀行振込をご利用いただけます。カード情報をこのサイトが保存することはありません。</div>'
  );
  html = html.replace(
    /<div class="support-ticket-source small-print">[\s\S]*?<\/div>/giu,
    ""
  );
  html = html.replace(
    /<p class="bank-note">※公開前にKFB側の最終確認を行い、変更がある場合は正本を更新します。口座情報の変更は推測で行いません。<\/p>/giu,
    '<p class="bank-note">※振込手数料はご利用の金融機関により異なります。</p>'
  );
  html = html.replace(
    /<div class="preview-note"><strong>Private preview:<\/strong>[\s\S]*?<\/div>/giu,
    '<div class="preview-note"><strong>Card giving is currently being prepared.</strong> Bank transfer is available now. This website does not store card information.</div>'
  );

  html = removeAnnualSection(html);

  const lang = /<html\s+lang="en"/iu.test(html) ? "en" : "ja";
  html = addPrivacyLink(html, lang);

  return html;
}


async function publicContentIndex(request, env) {
  const sourceUrl = new URL("/data/content-index.json", request.url);
  const source = await env.ASSETS.fetch(new Request(sourceUrl.toString(), request));
  if (!source.ok) return notFound();

  let data;
  try {
    data = await source.json();
  } catch {
    return notFound();
  }

  const items = Array.isArray(data.items)
    ? data.items
        .filter((item) => item?.status === "published" && item?.privacy === "public_safe")
        .map((item) => ({
          id: item.id,
          type: item.type,
          published_at: item.published_at ?? null,
          slug: item.slug ?? null,
          url_ja: item.url_ja ?? null,
          url_en: item.url_en ?? null,
          title_ja: item.title_ja ?? "",
          title_en: item.title_en ?? "",
          excerpt_ja: item.excerpt_ja ?? "",
          excerpt_en: item.excerpt_en ?? "",
          tags: Array.isArray(item.tags) ? item.tags : [],
          image: item.image && typeof item.image === "object" ? item.image : {},
        }))
    : [];

  const body = JSON.stringify({
    schema: 1,
    updated_at: data.updated_at ?? null,
    type_order: Array.isArray(data.type_order) ? data.type_order : [],
    types: data.types && typeof data.types === "object" ? data.types : {},
    tags: data.tags && typeof data.tags === "object" ? data.tags : {},
    items,
  });
  const headers = publicHeaders(new Headers({ "Content-Type": "application/json; charset=utf-8" }), "application/json");
  return new Response(body, { status: 200, headers });
}

function publicContentFeed() {
  const headers = publicHeaders(new Headers({ "Content-Type": "application/javascript; charset=utf-8" }), "application/javascript");
  return new Response(PUBLIC_CONTENT_FEED_SCRIPT, { status: 200, headers });
}

async function publicSitemap(request, env) {
  const base = "https://kfbokinawa.org";
  const core = [
    "/", "/ja/", "/en/",
    "/ja/about/", "/en/about/",
    "/ja/what-we-do/", "/en/what-we-do/",
    "/ja/activities/", "/en/activities/",
    "/ja/support/", "/en/support/",
    "/ja/contact/", "/en/contact/",
    "/ja/privacy/", "/en/privacy/"
  ];

  const dataUrl = new URL("/data/content-index.json", request.url);
  const response = await env.ASSETS.fetch(new Request(dataUrl.toString(), request));
  let items = [];
  if (response.ok) {
    try {
      const data = await response.json();
      items = Array.isArray(data.items)
        ? data.items.filter((item) => item?.status === "published" && item?.privacy === "public_safe")
        : [];
    } catch {}
  }

  const urls = new Set(core);
  for (const item of items) {
    if (item.url_ja) urls.add(item.url_ja);
    if (item.url_en) urls.add(item.url_en);
  }

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...[...urls].map((path) => `  <url><loc>${base}${path}</loc></url>`),
    "</urlset>",
    ""
  ].join("\n");

  const headers = publicHeaders(new Headers({ "Content-Type": "application/xml; charset=utf-8" }), "application/xml");
  return new Response(body, { status: 200, headers });
}

async function privatePreview(request, env, url) {
  if (url.pathname === "/robots.txt") {
    const headers = privacyHeaders(new Headers({ "Content-Type": "text/plain; charset=utf-8" }));
    return new Response("User-agent: *\nDisallow: /\n", { status: 200, headers });
  }

  const credential = env.KFB_PREVIEW_CREDENTIAL;
  if (!credential) {
    const headers = privacyHeaders(new Headers({ "Content-Type": "text/plain; charset=utf-8" }));
    return new Response("KFB preview access is not configured.", { status: 503, headers });
  }

  const expected = `Basic ${btoa(credential)}`;
  const actual = request.headers.get("Authorization") ?? "";
  if (!constantTimeEqual(actual, expected)) return unauthorized();

  const assetResponse = await env.ASSETS.fetch(request);
  const headers = privacyHeaders(new Headers(assetResponse.headers));
  return new Response(assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers,
  });
}

async function publicSite(request, env, url) {
  if (url.hostname === WWW_HOST) {
    const target = new URL(request.url);
    target.hostname = PUBLIC_HOST;
    target.protocol = "https:";
    return Response.redirect(target.toString(), 301);
  }

  if (url.pathname === "/robots.txt") {
    const headers = publicHeaders(new Headers({ "Content-Type": "text/plain; charset=utf-8" }), "text/plain");
    return new Response(
      "User-agent: *\nAllow: /\nSitemap: https://kfbokinawa.org/sitemap.xml\n",
      { status: 200, headers }
    );
  }

  if (url.pathname === "/sitemap.xml") return publicSitemap(request, env);
  if (url.pathname === "/data/content-index.json") return publicContentIndex(request, env);
  if (url.pathname === "/assets/js/content-feed.js") return publicContentFeed();
  if (isPrivateOnlyPath(url.pathname)) return notFound();

  const assetResponse = await env.ASSETS.fetch(request);
  const contentType = assetResponse.headers.get("Content-Type") ?? "";
  const headers = publicHeaders(new Headers(assetResponse.headers), contentType);

  if (/text\/html/iu.test(contentType)) {
    const body = publicizeHtml(await assetResponse.text());
    headers.set("Content-Type", "text/html; charset=utf-8");
    return new Response(body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  }

  return new Response(assetResponse.body, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === PUBLIC_HOST || url.hostname === WWW_HOST) {
      return publicSite(request, env, url);
    }
    if (url.hostname === PREVIEW_HOST || url.hostname.endsWith(".workers.dev")) {
      return privatePreview(request, env, url);
    }

    const headers = privacyHeaders(new Headers({ "Content-Type": "text/plain; charset=utf-8" }));
    return new Response("Host not configured.", { status: 404, headers });
  },
};
