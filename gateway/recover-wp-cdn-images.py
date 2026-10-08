#!/usr/bin/env python3
"""Recover ONLY publicly published original WordPress CDN media into an encrypted workflow artifact.
No recovered image bytes are committed or printed.
"""
import concurrent.futures, hashlib, html, json, os, pathlib, re, sys, urllib.parse, urllib.request, zipfile
from collections import Counter
root=pathlib.Path(os.environ["SNAPSHOT_DIR"])
records=json.loads((root/"data/legacy-preview.json").read_text(encoding="utf-8"))["items"]
out=pathlib.Path(os.environ["RUNNER_TEMP"])/"wp-photo-recovery"
out.mkdir(exist_ok=True)
rx=re.compile(r'<img\b[^>]*\bsrc\s*=\s*["\']([^"\']+)',re.I)
refs={}
for it in records:
    if it["source"]!="WORDPRESS":continue
    urls=rx.findall(it.get("body_html",""))
    if isinstance(it.get("image"),dict):urls.append(it["image"].get("src",""))
    for raw in set(urls):
        url=html.unescape(raw)
        p=urllib.parse.urlsplit(url)
        if not (p.scheme=="https" and p.hostname in ("i0.wp.com","i1.wp.com","i2.wp.com")):continue
        if not ("kodomofoodbankkfb.com/wp-content/uploads" in p.path or "img01.ti-da.net/" in p.path):continue
        refs[(it["id"],url)]=None
print("WordPress image CDN requests",len(refs))
def fetch(ref):
    id,url=ref
    try:
        parts=urllib.parse.urlsplit(url)
        encoded_url=urllib.parse.urlunsplit((parts.scheme,parts.netloc,urllib.parse.quote(parts.path,safe="/%:@"),parts.query,parts.fragment))
        req=urllib.request.Request(encoded_url,headers={"User-Agent":"Mozilla/5.0 (compatible; KFB archival restoration)",
          "Accept":"image/avif,image/webp,image/jpeg,image/png,image/*;q=0.7,*/*;q=0.1"})
        with urllib.request.urlopen(req,timeout=24) as response:
            ct=response.headers.get("Content-Type","").split(";")[0].strip().lower()
            if int(response.status)!=200:return (id,url,"http_"+str(response.status),None,None)
            raw=response.read(12*1024*1024+1)
        if len(raw)>12*1024*1024:return (id,url,"too_large",None,None)
        if raw.startswith(b"\xff\xd8\xff"):ext=".jpg"
        elif raw.startswith(b"\x89PNG\r\n\x1a\n"):ext=".png"
        elif raw.startswith(b"GIF8"):ext=".gif"
        elif raw.startswith(b"RIFF") and raw[8:12]==b"WEBP":ext=".webp"
        else:return (id,url,"not_an_image_"+ct,None,None)
        if len(raw)<1024:return (id,url,"too_short",None,None)
        sha=hashlib.sha256(raw).hexdigest()
        name="recovered/"+id+"/"+sha[:24]+ext
        dest=out/name
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_bytes(raw)
        return (id,url,"ok",name,sha)
    except Exception as e:
        # Do not expose remote response body or URL containing user data in logs.
        return (id,url,type(e).__name__,None,None)
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    for item in pool.map(fetch, refs):results.append(item)
metadata=[{"id":id,"url":url,"status":status,"name":name,"sha256":sha} for id,url,status,name,sha in results]
(out/"manifest.json").write_text(json.dumps({"schema":"kfb-wp-cdn-recovery-v1","results":metadata},ensure_ascii=False,indent=2),encoding="utf-8")
target=pathlib.Path(os.environ["RUNNER_TEMP"])/"wp-photo-recovery.zip"
with zipfile.ZipFile(target,"w",zipfile.ZIP_DEFLATED,compresslevel=5) as z:
    for p in out.rglob("*"):
        if p.is_file():z.write(p,p.relative_to(out))
print("WordPress CDN recovery",dict(Counter(x["status"] for x in metadata)),"archive bytes",target.stat().st_size)
