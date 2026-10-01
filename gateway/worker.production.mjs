function securityHeaders(headers = new Headers()) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return headers;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname.toLowerCase() === "www.kfbokinawa.org") {
      const target = new URL(request.url);
      target.protocol = "https:";
      target.hostname = "kfbokinawa.org";
      return Response.redirect(target.toString(), 301);
    }

    if (url.pathname === "/robots.txt") {
      const headers = securityHeaders(new Headers({
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      }));
      return new Response(
        "User-agent: *\nAllow: /\nSitemap: https://kfbokinawa.org/sitemap.xml\n",
        { status: 200, headers },
      );
    }

    const assetResponse = await env.ASSETS.fetch(request);
    const headers = securityHeaders(new Headers(assetResponse.headers));
    const contentType = headers.get("Content-Type") || "";

    if (contentType.includes("text/html")) {
      headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    }

    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  },
};
