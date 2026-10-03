import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
if (!root) throw new Error("Usage: node gateway/normalize-production-robots.mjs <snapshot-dir>");

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) out.push(full);
  }
  return out;
}

let changed = 0;
for (const file of walk(root)) {
  let html = fs.readFileSync(file, "utf8");
  const before = html;
  html = html.replace(
    /<meta\b(?=[^>]*\bname=["']robots["'])(?=[^>]*\bcontent=["'][^"']*noindex[^"']*["'])[^>]*>/giu,
    '<meta name="robots" content="index,follow">'
  );
  if (html !== before) {
    fs.writeFileSync(file, html);
    changed += 1;
  }
}
console.log(`Normalized production robots meta in ${changed} HTML file(s).`);
