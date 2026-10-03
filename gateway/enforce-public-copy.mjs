import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
if (!root) {
  console.error("Usage: node gateway/enforce-public-copy.mjs <snapshot-dir>");
  process.exit(2);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) out.push(full);
  }
  return out;
}

const commonReplacements = [
  ['<small>公開前プレビュー：検索エンジン非公開</small>', ''],
  ['<small>公開前プレビュー</small>', ''],
  ['<small>Private pre-release preview</small>', ''],
];

const pathReplacements = {
  "ja/support/index.html": [
    ['子どもフードバンクKFBへの支援方法。カード寄付の準備状況、銀行振込、企業・団体支援、ボランティアについてご案内します。', '子どもフードバンクKFBへの支援方法。カード寄付、銀行振込、企業・団体支援、ボランティアについてご案内します。'],
    ['ツクツクで運用している寄付チケット8プランを、現在の支払額でStripeサンドボックスに接続しています。単発支援・毎月の継続支援ともに、実際の本番サイトと同じ導線でテストできます。', 'カードで、1回の支援または毎月の継続支援をお選びいただけます。'],
    ['<div class="preview-note"><strong>現在はテスト決済です。</strong> Stripeのサンドボックスを使用しているため、実際の請求・入金は発生しません。クライアント確認後に本番Stripeへ切り替えます。</div>', ''],
    ['<div class="preview-note"><strong>確認中の設定です。</strong> 金額はツクツクの現行チケットで確認できた支払額を維持しています。税区分・最終金額・継続条件はKFB側の確認後に確定します。本番Stripe有効化時には決済リンクを本番用へ差し替えます。</div>', ''],
    ['>テスト決済へ</a>', '>この金額で支援する</a>'],
    ['>継続支援をテスト</a>', '>毎月支援する</a>'],
    [' data-stripe-sandbox="true"', ''],
    ['<div class="support-ticket-source small-print">カード情報はこのサイトやAIでは保存せず、Stripeの決済画面で処理します。現在のリンクはStripeサンドボックスです。</div>', '<div class="support-ticket-source small-print">カード情報はKFBサイトでは保存されず、Stripeの決済画面で安全に処理されます。</div>'],
    ['<p class="bank-note">※公開前にKFB側の最終確認を行い、変更がある場合は正本を更新します。口座情報の変更は推測で行いません。</p>', ''],
    ['活動報告や年次・会計情報を通じて、いただいた支援がどのような活動につながったかを確認できるサイトづくりを進めています。', '活動報告や年次・会計情報を通じて、いただいた支援がどのような活動につながったかをお伝えします。'],
  ],
  "en/support/index.html": [
    ['Ways to support Kodomo Food Bank KFB in Okinawa, including planned card giving and Japanese bank transfer details.', 'Ways to support Kodomo Food Bank KFB in Okinawa, including card giving, Japanese bank transfer, partnerships and volunteering.'],
    ['KFB’s work is supported by donations and community cooperation. The site now includes a Stripe Sandbox checkout for testing card support while retaining bank transfer options.', 'KFB’s work is supported by donations and community cooperation. Choose the way of giving that works best for you, including card support and Japanese bank transfer.'],
    ['All eight support-ticket amounts currently used on Tsuku2 are now connected to Stripe Sandbox at the same payment amounts. Both one-time and monthly recurring contribution flows can be tested through the production-site experience.', 'Choose either a one-time contribution or ongoing monthly support by card.'],
    ['<div class="preview-note"><strong>Test payments only.</strong> Stripe Sandbox is active, so no real charge or payout will occur. The links will be replaced with live Stripe links after client verification and account activation.</div>', ''],
    ['<div class="preview-note"><strong>Configuration under review:</strong> these amounts match KFB\'s current Tsuku2 payment amounts. Tax treatment, final amounts and recurring terms remain subject to KFB confirmation. Live Stripe links will replace these sandbox links after account activation.</div>', ''],
    ['>Test checkout</a>', '>Support with this amount</a>'],
    ['>Test monthly checkout</a>', '>Give monthly</a>'],
    [' data-stripe-sandbox="true"', ''],
    ['These plans are intended to charge automatically each month after Stripe is connected.', 'Choose a monthly contribution to support KFB on an ongoing basis.'],
    ['<div class="support-ticket-source small-print">KFB and this website do not store card details. Card information is handled on Stripe\'s checkout surface. The current links use Stripe Sandbox.</div>', '<div class="support-ticket-source small-print">KFB does not store card details on this website. Card information is handled securely on Stripe\'s checkout surface.</div>'],
    ['These are KFB’s current domestic bank-transfer details. No SWIFT/BIC or international-wire information is shown because it has not been verified.', 'For domestic bank transfers in Japan, please use one of the accounts below.'],
    ['Bank-transfer fees, if any, depend on your bank. Details will be reconfirmed before public launch.', 'Bank-transfer fees, if any, depend on your bank.'],
  ],
  "ja/about/index.html": [
    ['<div class="section-head"><div><div class="kicker">Organization</div><h2>団体情報</h2></div><p>公開前プレビューでは、現在の公式情報源で確認できた内容を掲載しています。</p></div>', '<div class="section-head"><div><div class="kicker">Organization</div><h2>団体情報</h2></div></div>'],
    ['<article class="info-card trust-card"><h3>活動の事実を、誇張せず伝える</h3><p>人数・金額・実績などは確認できる資料に基づいて掲載し、推測や補完をしません。</p></article>', '<article class="info-card trust-card"><h3>活動と実績を、分かりやすく伝える</h3><p>活動報告や会計情報を通じて、いただいた支援がどのような活動につながったかを分かりやすくお伝えします。</p></article>'],
  ],
  "en/about/index.html": [
    ['<div class="section-head"><div><div class="kicker">Organization</div><h2>Organization information</h2></div><p>Current details below are based on KFB’s verified official information.</p></div>', '<div class="section-head"><div><div class="kicker">Organization</div><h2>Organization information</h2></div></div>'],
    ['<article class="info-card trust-card"><h3>Report verified facts</h3><p>Numbers, financial information and activity claims are published only when supported by reliable source records.</p></article>', '<article class="info-card trust-card"><h3>Share our work clearly</h3><p>Activity reports and financial information help show how community support connects to KFB’s work.</p></article>'],
  ],
  "ja/what-we-do/index.html": [
    ['現在の公式情報では、KFBの活動は大きく「子どもの居場所・食事提供」と「ひとり親家庭などへの食料・物資支援」の二つの柱で紹介されています。', 'KFBの活動は、大きく「子どもの居場所・食事提供」と「ひとり親家庭などへの食料・物資支援」の二つの柱で取り組んでいます。'],
    ['※個別のプログラムや開催頻度は時期により変わるため、常時実施を保証する表現にはしていません。', '※活動内容や開催頻度は時期によって異なります。'],
  ],
  "en/what-we-do/index.html": [
    ['Specific programs and schedules can change, so this page does not imply that every past activity is always available.', 'Programs and schedules vary over time.'],
  ],
  "ja/activities/index.html": [
    ['「種類」は記事の役割、「テーマ」は記事の内容を表します。新しい記事を追加すると、この一覧とTOPの新着が同じ正本から更新されます。', '「種類」は記事の役割、「テーマ」は記事の内容を表します。'],
    ['<span class="status-pill">会計画像確認中</span><h3>2024年度</h3><p>フードドライブやふるさと納税などの活動記録と、2025年3月20日掲載の会計報告を整理しています。</p>', '<span class="status-pill">活動・会計報告</span><h3>2024年度</h3><p>フードドライブやふるさと納税など、2024年度の活動記録をご覧いただけます。</p>'],
    ['<p class="small-print">会計数値は保存済みの公式原本から確認できたものだけを掲載しています。2024年度の会計表は画像原本を再確認中です。</p>', ''],
  ],
  "en/activities/index.html": [
    ['Saved records from the previous websites are being checked and organized by year. Figures will be published only from source documents.', 'Explore KFB’s annual activity and financial records by year.'],
    ['<span class="status-pill">Financial image under review</span><h3>FY2024</h3><p>Activity records are available; the financial report article is preserved while its accounting-table image source is being re-verified.</p>', '<span class="status-pill">Activity & financial report</span><h3>FY2024</h3><p>Explore FY2024 activity records including food-drive and hometown-tax support updates.</p>'],
    ['<span class="status-pill">Source verified</span>', '<span class="status-pill">Activity & financial report</span>'],
    ['<p class="small-print">Financial figures are published only when confirmed in archived official source records. FY2024 accounting-table images are still being re-verified.</p>', ''],
  ],
  "ja/activities/video-rkbNbDKpgZA/index.html": [
    ['<div class="content-note">この動画の公開日は、現在保存している原本だけでは確定できないため、推測して掲載していません。</div>', ''],
  ],
  "en/activities/video-rkbNbDKpgZA/index.html": [
    ['<div class="content-note">The publication date is not shown because it cannot yet be confirmed from the preserved source material.</div>', ''],
  ],
  "ja/activities/2024/index.html": [
    ['<div class="year-fact"><strong>確認中</strong><span>会計表の数値画像原本</span></div>', ''],
    ['<div class="notice"><strong>数値はまだ掲載していません。</strong><p>保存した本文からは「2024年度の会計報告をさせていただきます」「昨年も皆様に支えられて活動する事が出来ました」と確認できます。一方、会計表の2画像は保存時に正常な画像データとして取得できていなかったため、金額を推測せず、画像原本を再確認できるまで非表示にしています。</p></div>', '<div class="notice"><p>2024年度の会計報告は、2025年3月20日に旧公式ブログで公開されました。</p></div>'],
    ['出典：KFB旧ツクツク公式ブログ「2024年度会計報告」（2025年3月20日掲載）の保存原本。会計数値は画像原本の再確認後に反映します。', '出典：KFB旧ツクツク公式ブログ「2024年度会計報告」（2025年3月20日掲載）'],
  ],
  "en/activities/2024/index.html": [
    ['<div class="year-fact"><strong>Under review</strong><span>Financial-table image source</span></div>', ''],
    ['<div class="notice"><strong>Financial figures are not shown yet.</strong><p>The preserved article confirms the FY2024 report and thanks supporters, but the two accounting-table images were not successfully preserved as usable image data. KFB will not reconstruct or guess the figures; they will be added only after the image originals are verified.</p></div>', '<div class="notice"><p>KFB published its FY2024 financial report on March 20, 2025.</p></div>'],
  ],
  "ja/activities/2023/index.html": [
    ['出典：KFBが旧ツクツク公式ブログに掲載した「2023年度会計報告」および「2023年度募金箱についてのご報告」の保存原本。未記載の項目や差額は推測で補っていません。', '出典：KFB旧ツクツク公式ブログ「2023年度会計報告」「2023年度募金箱についてのご報告」'],
  ],
  "en/activities/2023/index.html": [
    ['Source: archived KFB official Tsuku2 blog posts for the FY2023 financial report and 2023 donation-box report. No unreported balance or other figures have been inferred.', 'Source: KFB official Tsuku2 blog posts for the FY2023 financial report and 2023 donation-box report.'],
  ],
};

const forbidden = [
  "公開前プレビュー",
  "Private pre-release preview",
  "現在はテスト決済です。",
  "Stripeサンドボックス",
  "クライアント確認後に本番Stripe",
  "実際の本番サイトと同じ導線でテストできます",
  "確認中の設定です。",
  "本番Stripe有効化時には",
  "公開前にKFB側の最終確認",
  "常時実施を保証する表現",
  "推測して掲載していません",
  "未記載の項目や差額は推測で補っていません",
  "会計数値は画像原本の再確認後に反映します",
  "Test payments only.",
  "Stripe Sandbox",
  "client verification and account activation",
  "production-site experience",
  "Configuration under review:",
  "before public launch",
  "does not imply that every past activity is always available",
  "cannot yet be confirmed from the preserved source material",
  "Under review</strong><span>Financial-table image source",
  "No unreported balance or other figures have been inferred.",
  "同じ正本から更新されます",
  "会計画像確認中",
  "画像原本を再確認中",
  "Saved records from the previous websites are being checked and organized by year",
  "Financial image under review",
  "Source verified",
  "being re-verified",
  "旧サイト移行記録",
  "旧サイトから保全した活動記録",
  "最終的な公開可否は移行レビュー",
  "旧サイト原文",
  "移行内容との照合用",
  "旧サイト側の原文も確認できます",
  "元ページを開く",
  "旧サイト移行記事",
  "保存原本から利用できる本文を確認できませんでした",
  "English archive translation",
  "protected migration review",
  "Original legacy page",
  "Open the source page preserved from the previous website.",
  "Open original page",
  "KFB legacy archive",
  "The preserved source does not contain usable body text.",
];

let changedFiles = 0;
const violations = [];
for (const file of walk(root)) {
  const rel = path.relative(root, file).split(path.sep).join("/");
  let html = fs.readFileSync(file, "utf8");
  const before = html;

  for (const [from, to] of commonReplacements) html = html.split(from).join(to);
  for (const [from, to] of pathReplacements[rel] ?? []) html = html.split(from).join(to);

  if (html !== before) {
    fs.writeFileSync(file, html);
    changedFiles += 1;
  }

  for (const phrase of forbidden) {
    if (html.includes(phrase)) violations.push({ rel, phrase });
  }
}

if (violations.length) {
  console.error("Public-copy hygiene failed. Internal/editorial copy remains in deployable HTML:");
  for (const v of violations) console.error(`- ${v.rel}: ${v.phrase}`);
  process.exit(1);
}

console.log(`Public-copy hygiene passed. Normalized ${changedFiles} HTML file(s); no forbidden internal markers remain.`);
