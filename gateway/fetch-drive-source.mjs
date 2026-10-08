import { createHash, createSign } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

const folderId = process.env.DRIVE_SOURCE_FOLDER_ID;
const serviceAccountText = process.env.GDRIVE_SERVICE_ACCOUNT_JSON;
const snapshotPathValue = process.env.SNAPSHOT_DIR;

if (!folderId || !serviceAccountText || !snapshotPathValue) {
  throw new Error("Drive source folder, service-account secret, or snapshot path is not configured.");
}

const snapshotRoot = resolve(snapshotPathValue);
const runnerTemp = process.env.RUNNER_TEMP ? resolve(process.env.RUNNER_TEMP) : "";
if (!runnerTemp || snapshotRoot === runnerTemp || !snapshotRoot.startsWith(runnerTemp + sep)) {
  throw new Error("Snapshot path must be a dedicated child of RUNNER_TEMP.");
}

const serviceAccount = JSON.parse(serviceAccountText);
if (!serviceAccount.client_email || !serviceAccount.private_key) {
  throw new Error("Google service-account secret is incomplete.");
}

const MAX_FILES = 1500;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
// Only Drive-owned protected-preview photo bundles may exceed the ordinary file limit.
const MAX_LEGACY_REVIEW_ZIP_BYTES = 45 * 1024 * 1024;
function maxAllowedFileBytes(path) {
  return /^data\/legacy-media-bundles\/kfb-review-media-[0-9]+\.zip$/u.test(path)
    ? MAX_LEGACY_REVIEW_ZIP_BYTES : MAX_FILE_BYTES;
}
const MAX_TOTAL_BYTES = 250 * 1024 * 1024;
const encoder = new TextEncoder();

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeName(name) {
  return Boolean(name) &&
    name !== "." &&
    name !== ".." &&
    !/[<>:"/\\|?*\u0000-\u001f]/u.test(name) &&
    !/[. ]$/u.test(name);
}

function sensitivePath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (/(?:^|\/)(?:\.git|node_modules|\.wrangler|\.runtime-site)(?:\/|$)/iu.test(normalized)) return true;
  const base = normalized.split("/").at(-1) ?? "";
  return /^(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?|service[-_]?account.*\.json|.*\.(?:pem|p12|pfx|key))$/iu.test(base);
}

async function getAccessToken() {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));

  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();

  const assertion = `${unsigned}.${signer.sign(serviceAccount.private_key).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Google OAuth token request failed (HTTP ${response.status}).`);
  }

  const payload = await response.json();
  if (!payload.access_token) throw new Error("Google OAuth did not return an access token.");
  return payload.access_token;
}

const accessToken = await getAccessToken();

async function listChildren(parentId) {
  const files = [];
  let pageToken;

  do {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", `'${parentId}' in parents and trashed = false`);
    url.searchParams.set("pageSize", "1000");
    url.searchParams.set("orderBy", "name");
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,size,modifiedTime,md5Checksum)");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Google Drive listing failed (HTTP ${response.status}).`);
    }

    const payload = await response.json();
    files.push(...(payload.files ?? []));
    pageToken = payload.nextPageToken;
  } while (pageToken);

  return files;
}

async function scanTree(rootId) {
  const records = [];

  async function visit(parentId, prefix = "", depth = 0) {
    if (depth > 30) throw new Error("Drive source nesting exceeds the safety limit.");

    for (const item of await listChildren(parentId)) {
      if (!safeName(item.name)) throw new Error(`Unsafe Drive filename: ${item.name}`);
      const relativePath = prefix ? `${prefix}/${item.name}` : item.name;
      if (sensitivePath(relativePath)) throw new Error(`Sensitive or build-only path is not allowed: ${relativePath}`);
      if (item.mimeType === "application/vnd.google-apps.shortcut") {
        throw new Error(`Drive shortcuts are not allowed in site source: ${relativePath}`);
      }

      const record = {
        id: item.id,
        path: relativePath,
        mimeType: item.mimeType,
        size: Number(item.size ?? 0),
        modifiedTime: item.modifiedTime ?? "",
        md5Checksum: item.md5Checksum ?? "",
      };
      records.push(record);

      if (item.mimeType === "application/vnd.google-apps.folder") {
        await visit(item.id, relativePath, depth + 1);
      } else if (item.mimeType.startsWith("application/vnd.google-apps.")) {
        throw new Error(`Native Google Workspace files are not allowed inside deployable site source: ${relativePath}`);
      }
    }
  }

  await visit(rootId);
  records.sort((a, b) => a.path.localeCompare(b.path, "en"));

  if (records.length > MAX_FILES) {
    throw new Error(`Drive source exceeds the ${MAX_FILES}-item safety limit.`);
  }

  const files = records.filter((record) => record.mimeType !== "application/vnd.google-apps.folder");
  if (files.length === 0) throw new Error("Drive source folder is empty.");

  const folded = new Set();
  let totalBytes = 0;
  for (const file of files) {
    const key = file.path.toLocaleLowerCase("en-US");
    if (folded.has(key)) throw new Error(`Case-insensitive filename collision: ${file.path}`);
    folded.add(key);

    if (file.size > maxAllowedFileBytes(file.path)) {
      throw new Error(`File exceeds the per-file safety limit: ${file.path}`);
    }
    totalBytes += file.size;
  }

  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error("Drive source exceeds the total snapshot safety limit.");
  }

  return { records, files, totalBytes };
}

function metadataFingerprint(records) {
  const stable = records.map((r) =>
    [r.id, r.path, r.mimeType, r.size, r.modifiedTime, r.md5Checksum].join("\t")
  ).join("\n");
  return sha256(encoder.encode(stable));
}

const before = await scanTree(folderId);

await rm(snapshotRoot, { recursive: true, force: true });
await mkdir(snapshotRoot, { recursive: true });

const downloadedHashes = [];

for (const file of before.files) {
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}`);
  url.searchParams.set("alt", "media");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    throw new Error(`Google Drive download failed for ${file.path} (HTTP ${response.status}).`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > maxAllowedFileBytes(file.path)) throw new Error(`Downloaded file exceeds limit: ${file.path}`);

  const target = resolve(snapshotRoot, ...file.path.split("/"));
  if (target !== snapshotRoot && !target.startsWith(snapshotRoot + sep)) {
    throw new Error("Drive source path escaped the snapshot directory.");
  }

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  downloadedHashes.push([file.path, sha256(bytes)]);
}

const after = await scanTree(folderId);
if (metadataFingerprint(before.records) !== metadataFingerprint(after.records)) {
  await rm(snapshotRoot, { recursive: true, force: true });
  throw new Error("Drive source changed during snapshot download. No deployment will be attempted.");
}

downloadedHashes.sort(([a], [b]) => a.localeCompare(b, "en"));
const sourceFingerprint = sha256(encoder.encode(downloadedHashes.map(([path, hash]) => `${path}\t${hash}`).join("\n")));

if (process.env.GITHUB_OUTPUT) {
  const prior = await readFile(process.env.GITHUB_OUTPUT, "utf8").catch(() => "");
  await writeFile(process.env.GITHUB_OUTPUT, `${prior}source_fingerprint=${sourceFingerprint}\n`, "utf8");
}

console.log(`Fetched ${before.files.length} KFB Drive files (${before.totalBytes} bytes). Snapshot fingerprint: ${sourceFingerprint}`);
