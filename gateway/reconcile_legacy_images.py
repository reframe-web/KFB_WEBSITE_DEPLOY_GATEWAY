#!/usr/bin/env python3
"""KFB legacy photo restoration from *verified* originals into private Drive staging.

No Google credentials, network calls, publication or user approval changes.
Requires explicit source-url-to-file mapping, with provenance and attesting owner.
Usage:
  python reconcile_legacy_images.py --legacy-preview legacy-preview.json \
    --legacy-feed legacy-feed.json --outstanding-audit KFB_LEGACY_MEDIA_RECOVERY_AUDIT_V4.json \
    --mapping authenticated-original-mapping.json --files-root recovered-originals --outdir staging
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import pathlib
import re
import sys
import zipfile
from datetime import datetime, timezone
from PIL import Image, ImageOps, UnidentifiedImageError

Image.MAX_IMAGE_PIXELS = 30000000
MAX_BYTES = 15 * 1024 * 1024
ALLOWED_EVIDENCE = {"authorized_cms_download", "kfb_owner_direct_original", "verified_official_public_original"}


def load_json(file):
    return json.loads(pathlib.Path(file).read_text(encoding="utf-8"))


def check_file(path_text, files_root):
    root = pathlib.Path(files_root).resolve(strict=True)
    rel = pathlib.Path(path_text)
    if rel.is_absolute() or ".." in rel.parts or len(rel.parts) == 0:
        raise ValueError("Recovered file reference must be a relative path under files-root")
    file = (root / rel).resolve(strict=True)
    if not file.is_relative_to(root) or not file.is_file():
        raise ValueError("File path escaped private recovery root")
    if file.stat().st_size > MAX_BYTES or file.stat().st_size < 100:
        raise ValueError("Original file size is invalid")
    return file


def encode_safe_webp(original_bytes):
    with Image.open(io.BytesIO(original_bytes)) as incoming:
        incoming.verify()
    with Image.open(io.BytesIO(original_bytes)) as incoming:
        if incoming.format not in {"JPEG", "PNG", "WEBP", "GIF"}:
            raise ValueError("Unacceptable original file format")
        image = ImageOps.exif_transpose(incoming)
        image.load()
        if image.width < 40 or image.height < 40:
            raise ValueError("Unacceptably small original image")
        if image.width * image.height > Image.MAX_IMAGE_PIXELS:
            raise ValueError("Decompression bomb protection")
        # WebP strips original location EXIF and other metadata.
        image = image.convert("RGB")
        output = io.BytesIO()
        image.save(output, format="WEBP", quality=82, method=6)
        return output.getvalue(), (image.width, image.height)


def main(args):
    src = load_json(args.legacy_preview)
    feed = load_json(args.legacy_feed)
    audit = load_json(args.outstanding_audit)
    mapping = load_json(args.mapping)
    if not all(isinstance(x.get("items"), list) for x in (src, feed)):
        raise ValueError("Invalid canonical source/feed structure")
    if not isinstance(mapping.get("images"), list):
        raise ValueError("Expected mapping file: {images:[...]} ")
    outstanding = {}
    for row in audit.get("outstanding", []):
        key = row["source_url"]
        outstanding.setdefault(key, set()).add(row["id"])
    src_by_id = {item["id"]:item for item in src["items"]}
    feed_by_id = {item["id"]:item for item in feed["items"]}
    if len(src_by_id) != len(src["items"]) or len(feed_by_id) != len(feed["items"]):
        raise ValueError("Duplicate article ID in canonical data")
    seen_urls = set()
    stage = pathlib.Path(args.outdir)
    stage.mkdir(parents=True, exist_ok=True)
    bundle = stage / "kfb-review-media-04.zip"
    results = []
    with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as z:
        for row in mapping["images"]:
            url = row.get("source_url")
            method = row.get("provenance")
            attester = row.get("attested_by")
            if url in seen_urls:
                raise ValueError("Duplicate image source URL")
            seen_urls.add(url)
            if url not in outstanding:
                raise ValueError("Image source not in canonical unresolved queue")
            if method not in ALLOWED_EVIDENCE or not isinstance(attester, str) or len(attester.strip()) < 2:
                raise ValueError("Missing authorized provenance/owner attestation")
            original = check_file(row.get("file", ""), args.files_root).read_bytes()
            encoded, dims = encode_safe_webp(original)
            sha = hashlib.sha256(original).hexdigest()
            for article_id in outstanding[url]:
                article = src_by_id.get(article_id)
                if article is None or article.get("status") != "preview" or article.get("client_approved") is not False:
                    raise ValueError("Article not in unapproved protected preview")
                relative = f"assets/legacy/{article_id}/{sha[:16]}.webp"
                browser_url = "/" + relative
                for field in ("body_html", "body_en"):
                    if field in article:
                        article[field] = article[field].replace(url, browser_url)
                if isinstance(article.get("image"), dict) and article["image"].get("src") == url:
                    article["image"]["src"] = browser_url
                if feed_by_id.get(article_id):
                    f = feed_by_id[article_id]
                    if isinstance(f.get("image"), dict) and f["image"].get("src") == url:
                        f["image"]["src"] = browser_url
                for record in (article, feed_by_id.get(article_id)):
                    if record is None:
                        continue
                    if int(record.get("unresolved_media_count", 0)) < 1:
                        raise ValueError("Media count mismatch; review canonical data manually")
                    record["unresolved_media_count"] -= 1
                    record["local_media_count"] = int(record.get("local_media_count",0)) + 1
                    if record["unresolved_media_count"] == 0:
                        record["review_status"] = "awaiting_client_review"
                        record["media_review_state"] = "needs_visual_approval"
                z.writestr(relative, encoded)
                results.append({
                    "article_id": article_id, "original_url": url, "file": relative,
                    "original_sha256": sha, "original_bytes": len(original),
                    "image_dimensions": list(dims), "provenance": method,
                    "attested_by": attester,
                    "publication_approved": False,
                    "represented_by_existing": bool(article.get("represented_by_existing")),
                })
    summary = {
        "schema":"kfb-authenticated-image-recovery-v1",
        "created_at":datetime.now(timezone.utc).isoformat(),
        "nature":"PROTECTED_PREVIEW_STAGING_ONLY",
        "original_publication_permission":False,
        "recovered_references":len(results),
        "unresolved_references":len(audit["outstanding"]) - len(results),
        "audit":results,
    }
    (stage / "legacy-preview.json").write_text(json.dumps(src,ensure_ascii=False,indent=2),encoding="utf-8")
    (stage / "legacy-feed.json").write_text(json.dumps(feed,ensure_ascii=False,indent=2),encoding="utf-8")
    (stage / "recovery-staging-report.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({"restored_references":len(results),"left_unrestored_references":summary["unresolved_references"],
        "originals_zip":str(bundle),"status":"PRIVATE_STAGING_NOT_PUBLISHED"},ensure_ascii=False))


if __name__ == "__main__":
    p=argparse.ArgumentParser(description=__doc__)
    for name in ("legacy-preview","legacy-feed","outstanding-audit","mapping","files-root","outdir"):
        p.add_argument("--"+name,required=True,dest=name.replace("-","_"))
    main(p.parse_args())
