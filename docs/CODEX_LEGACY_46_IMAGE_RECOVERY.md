# KFB: remaining 46 legacy article image originals — recovery handoff

Status: **46 affected articles, 125 exact original image URLs**. 44 articles / 122 URLs in Tsuku2; 2 articles / 3 URLs in old WordPress TI-DA. **Not complete.** No image or child-photo public release is authorized.

## Source of truth

Google Drive KFB official source (`KFB_CURRENT_STATE`, canonical `legacy-preview.json`, `legacy-feed.json`) is authoritative, **not this repository**. The prior audit exists privately as `KFB_LEGACY_MEDIA_RECOVERY_AUDIT_V4.json`. A 46-case exact URL checklist has been saved privately to the Ops folder as `KFB_残り46記事_原画像125参照_回収台帳.csv`. Never paste that file or child images into a public repository, issue, CI log, or open bug report.

## What is known / what must not be assumed

1. `TSUKUTSUKU_ORIGINAL_IMAGES_2026-09-25.zip` contains 172 supposed blog photos which are actually 150-byte HTML `502 Bad Gateway` responses, **not photos**.
2. Direct original `web-resource.tsuku2.jp/pic/blog/...` HTTP requests currently return HTTP 403, even for full GET with a normal browser User-Agent. Earlier a single FY2024 accounting JPEG was independently recovered; that does not mean the other files can be guessed from it.
3. Internet Archive CDX searches for the relevant image URL/prefix found no 200 captures; WordPress-related TI-DA originals returned 404. **Do not bypass access controls or claim to have recovered missing originals.**
4. An archived full-page screenshot contains **8 small real old-site card thumbnail cutouts**, preserved separately under private Drive `10_LEGACY/TSUKUTSUKU/2026-10-08_46件画像回収_画面証拠_非公開`. These **are derivative visual evidence, not photo originals**, and cannot be counted among the 125 recovered files. No photo publication consent is inferred.
5. The external social/YouTube archives can give leads but unrelated photos must not be substituted for an original based only on topic/date.

## Codex implementation tasks

- Build a **read-only, owner-authorized browser extraction path** for the official Tsuku2 CMS at `https://cms2.tsuku2.shop/login.php`. Authentication is performed by an authorized KFB representative using their own secure browser / Work session; **never ask for passwords in chat, GitHub issues, or code**. Determine whether the old blogs and image library remain accessible. If they do, export original images with their exact source URL / article ID associations into **private Drive archival storage**. If absent, use the authorized vendor support channel for a historical media export request containing the 125 exact original URLs (from the private Ops queue).
- On ingestion, use the included `reconcile_legacy_images.py` tool with explicit `authenticated-original-mapping.json` mapping `source_url` → actual original binary. Require provenance and a responsible human attester. Compare against the canonical outstanding audit; never make a best-guess match by title alone.
- Treat recovered screenshots or external media as **candidates**, not originals, until there is one-to-one provenance. Only normalized WebP derived from complete decodable original binary may enter protected preview. Strip EXIF/GPS. Safeguard children's identities and require client photo approval separately.
- The script produces an updated protected-preview source/feed, zip bundle `kfb-review-media-04.zip`, and private report; **these are staging only**. After reviewer verification, transfer updates to canonical KFB Google Drive and let KFB Publisher verify/redeploy **protected preview only**. Keep `client_approved=false`, `media_approved=false`, Basic Auth and `noindex` intact. Never trigger public production deployment or publish current preview media to a public GitHub artifact.
- Keep code/provider-agnostic and avoid vendor-specific secret storage. Add reproducible tests for URL correspondence, security, broken-file rejection, incorrect mapping, and source counter changes.

## Running the private importer

`pip install pillow` (in isolated runtime) and run:

```bash
python reconcile_legacy_images.py \
  --legacy-preview legacy-preview.json \
  --legacy-feed legacy-feed.json \
  --outstanding-audit KFB_LEGACY_MEDIA_RECOVERY_AUDIT_V4.json \
  --mapping authenticated-original-mapping.json \
  --files-root recovered-originals \
  --outdir private-staging
```

The mapping JSON is generated **only after** the original images are obtained securely, example shape:

```json
{
  "images": [
    {
      "source_url": "https://EXACT-SOURCE-URL-FROM-PRIVATE-QUEUE",
      "file": "photos/from-cms-export.jpg",
      "provenance": "authorized_cms_download",
      "attested_by": "KFB-authorized-operator"
    }
  ]
}
```

Never publicly release anything based solely on this importer output.

## Acceptance criteria

- Source image references recovered: **125 of 125**, or each unresolved record has a documented vendor non-availability decision and client approved a factual no-photo presentation; screenshots are not masqueraded as original images.
- 201 historical candidates remain individually unapproved until client checks privacy/rights/English translation.
- No missing external image URL appears in a completed legacy article; refer to the original archive only as editorial reference.
- Private-only Drive storage and Publisher fail-closed tests passed, including direct archive URLs, `assets/legacy`, Basic Auth/noindex, sitemap.
