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
