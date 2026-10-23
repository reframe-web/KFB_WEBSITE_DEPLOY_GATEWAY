# KFB Website Deploy Gateway

This public repository is the execution gateway for the new 子どもフードバンクKFB website.

**Status as of 2026-10-23:** Official public production is live at https://kfbokinawa.org/ (2026-10-22 all-page launch). The private `kfb-preview` host is a separate review environment. Always resolve mutable status from Drive `KFB_CURRENT_STATE` and the latest `KFB_WEB_CHANGELOG`, then verify live production.

## Source of truth

The website source itself is **not** stored in this repository.

Canonical source:

`Google Drive / KFB WEBSITE DEV / 40_SITE / SOURCE`

Current Drive source folder ID:

`1nIQrLm5e2mXIAAyE6pF-SdxSuiOhqyV8`

The gateway downloads a read-only, stable snapshot of that Drive folder into an ephemeral GitHub-hosted runner, validates it, deploys it, and removes the snapshot.

## Private preview policy (historical checkpoint / separate review host)

The separate access-controlled review target is the Cloudflare Worker `kfb-preview`. The rules below describe the pre-launch preview stage before KFB's all-page public approval on 2026-10-22. They are **not** the current status of the public `kfbokinawa.org` domain.

Before official public-release approval:

- the new site must remain authentication-protected;
- the Worker returns `X-Robots-Tag: noindex, nofollow, noarchive`;
- `/robots.txt` disallows all crawling;
- at the earlier preview stage, `kfbokinawa.org` was not connected to the unfinished site;
- the old `kodomofoodbankkfb.com` site remains untouched.

## Repository contents

This repository may contain only deployment workflows, validation code, and release request metadata.

Do **not** commit:

- KFB page source copied from Drive;
- child/family photos or private media;
- service-account JSON;
- Cloudflare API tokens;
- passwords;
- bank/payment credentials;
- other secrets.

## Private preview deployment flow (separate from production)

1. Edit the canonical source in Google Drive.
2. Trigger **Deploy KFB private preview from Drive** manually, or update `.deploy/preview-request.json`.
3. GitHub Actions obtains a read-only Google Drive token.
4. The gateway downloads a stable snapshot and verifies that the Drive tree did not change during download.
5. Source safety checks run before any deployment.
6. The snapshot is staged only inside the ephemeral runner.
7. Wrangler deploys the site as Cloudflare Worker Static Assets behind the preview authentication Worker.
8. Temporary source files are removed.

## Required GitHub Actions secrets

These are configured in GitHub Settings and must never be committed to this repository:

- `GDRIVE_SERVICE_ACCOUNT_JSON`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

The preview credential itself is intended to be stored as a **Cloudflare Worker secret** named:

- `KFB_PREVIEW_CREDENTIAL`

Its value should be in `username:password` form. If that secret is missing, the Worker fails closed and does not expose the site.

## Current public release (verified 2026-10-23)

The KFB client approved all site pages on 2026-10-22. The public Japanese/English site is live at **https://kfbokinawa.org/** without Basic Authentication; public pages allow indexing. The dedicated production workflow exists at `.github/workflows/deploy-production.yml`, with guarded request `.deploy/production-request.json`. Production run `39800495723` successfully built, deployed and verified the 2026-10-22 launch; the release request was disarmed afterward. The private workers.dev review host remains protected and is not the production site.

The 2026-10-23 Drive state records 163 old-WordPress source-path redirects active, Search Console sitemap submission (433 discovered URLs), and 26 unmapped taxonomy/author legacy URLs. Discovered URLs do not imply that all 433 pages are indexed. Older 158/OFF and preview-only statements are historical checkpoints.

### Publication and documentation discipline

- **Content and website source authority:** Google Drive `KFB WEBSITE DEV / 40_SITE / SOURCE`, plus current project decisions in `00_SYSTEM / KFB_CURRENT_STATE`.
- **Append-only audit trail:** `60_RESULTS / LOGS / KFB_WEB_CHANGELOG`. Record each meaningful operation's scope, approvals, outcome, live check, run ID and unresolved items, including failures. After a material change, reconcile `KFB_CURRENT_STATE` in the same work unit.
- **GitHub README/workflows:** execution instructions, not canonical current content or publication status. Reconcile this README when a workflow or release phase changes; never use an old README line to override newer Drive state or live verified production.
- Do not expose secrets or customer data in this public repository. Do not trigger production deployment solely to synchronize documentation.

