import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve, sep } from "node:path";

const rootArg = process.argv[2];
if (!rootArg) throw new Error("Usage: node gateway/verify-source.mjs <snapshot-directory>");

const root = resolve(rootArg);

const required = [
  "index.html",
  "ja/index.html",
  "en/index.html",
  "assets/css/site.css",
  "assets/js/site.js",
];

const textExtensions = new Set([
  ".html", ".htm", ".css", ".js", ".mjs", ".json", ".txt", ".xml", ".svg", ".md",
]);

const forbiddenTextPatterns = [
  { name: "private key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/u },
  { name: "GitHub classic token", re: /ghp_[A-Za-z0-9]{20,}/u },
  { name: "GitHub fine-grained token", re: /github_pat_[A-Za-z0-9_]{20,}/u },
  { name: "Google client secret field", re: /"client_secret"\s*:/u },
  { name: "Cloudflare API token variable assignment", re: /CLOUDFLARE_API_TOKEN\s*=/u },
  { name: "Google service-account variable assignment", re: /GDRIVE_SERVICE_ACCOUNT_JSON\s*=/u },
];

const forbiddenRuntimeReferences = [
  { name: "localhost", re: /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/iu },
  { name: "Windows local Drive path", re: /[A-Z]:\\(?:[^\r\n]+\\)?KFB WEBSITE DEV/iu },
];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

for (const requiredPath of required) {
  if (!(await exists(join(root, ...requiredPath.split("/"))))) {
    throw new Error(`Required site file is missing: ${requiredPath}`);
  }
}

const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.isFile()) files.push(full);
    else throw new Error(`Unsupported filesystem entry: ${full}`);
  }
}
await walk(root);

if (files.length === 0) throw new Error("Snapshot contains no deployable files.");

const normalizedPaths = files.map((file) => relative(root, file).split(sep).join("/"));

for (const p of normalizedPaths) {
  if (/^(?:\.env|\.dev\.vars)(?:\.|$)/iu.test(p.split("/").at(-1) ?? "")) {
    throw new Error(`Environment file must not be deployed: ${p}`);
  }
}

let htmlCount = 0;
for (let i = 0; i < files.length; i += 1) {
  const file = files[i];
  const rel = normalizedPaths[i];
  const extension = extname(file).toLocaleLowerCase("en-US");
  if (!textExtensions.has(extension)) continue;

  const body = await readFile(file, "utf8");

  for (const pattern of forbiddenTextPatterns) {
    if (pattern.re.test(body)) throw new Error(`Possible ${pattern.name} found in deployable source: ${rel}`);
  }

  if ([".html", ".htm", ".css", ".js", ".mjs", ".json", ".xml", ".svg"].includes(extension)) {
    for (const pattern of forbiddenRuntimeReferences) {
      if (pattern.re.test(body)) throw new Error(`Development-only ${pattern.name} found in deployable runtime source: ${rel}`);
    }
  }

  if (extension === ".html" || extension === ".htm") {
    htmlCount += 1;
    if (!/<html\b/iu.test(body) || !/<title>[^<]+<\/title>/iu.test(body)) {
      throw new Error(`HTML document is missing required document structure/title: ${rel}`);
    }
  }
}

if (htmlCount < 3) throw new Error("Expected at least the root, Japanese, and English HTML documents.");

console.log(`KFB source validation passed: ${files.length} files, ${htmlCount} HTML documents.`);
