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

function privacyHeaders(headers = new Headers()) {
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set("Cache-Control", "private, no-store");
  headers.set("Pragma", "no-cache");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  return headers;
}

function unauthorized() {
  const headers = privacyHeaders(new Headers());
  headers.set("WWW-Authenticate", 'Basic realm="KFB Private Preview", charset="UTF-8"');
  headers.set("Content-Type", "text/plain; charset=utf-8");
  return new Response("Authentication required.", { status: 401, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
  },
};
