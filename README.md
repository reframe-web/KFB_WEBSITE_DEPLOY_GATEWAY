# KFB Website Deploy Gateway

This public repository is the execution gateway for the new 子どもフードバンクKFB website.

## Source of truth

The website source itself is **not** stored in this repository.

Canonical source:

`Google Drive / KFB WEBSITE DEV / 40_SITE / SOURCE`

Current Drive source folder ID:

`1nIQrLm5e2mXIAAyE6pF-SdxSuiOhqyV8`

The gateway downloads a read-only, stable snapshot of that Drive folder into an ephemeral GitHub-hosted runner, validates it, deploys it, and removes the snapshot.

## Preview-first release policy

The current target is a private Cloudflare Worker named:

`kfb-preview`

Until explicit KFB public-release approval:

- the new site must remain authentication-protected;
- the Worker returns `X-Robots-Tag: noindex, nofollow, noarchive`;
- `/robots.txt` disallows all crawling;
- `kfbokinawa.org` is not connected to the unfinished site;
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

## Deployment flow

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

## Public release

This repository currently deploys the **private preview only**. Production deployment to `kfbokinawa.org` will be implemented as a separate, explicitly approved release path after content, privacy, donation, accessibility, SEO, and redirect checks are complete.
