// Domains whose CDNs block Next.js image optimization (return 403).
// Images from these domains are fetched server-side with a spoofed Referer
// that matches the main website, then streamed back to the browser.
// Key: CDN hostname → Referer to send when fetching that CDN.
//
// NOTE: static.carrefour.es is intentionally excluded — it sits behind
// Cloudflare Bot Management which blocks all server-side fetches regardless
// of headers (no Referer/User-Agent combination bypasses the bot score check).
// Carrefour search results are served without images instead.
const ALLOWED_HOSTNAME_REFERER: Record<string, string> = {};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  if (!imageUrl) {
    return Response.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  // SSRF protection: only HTTPS and pre-approved hostnames are allowed.
  if (parsed.protocol !== "https:") {
    return Response.json(
      { error: "Only HTTPS URLs are allowed" },
      { status: 400 },
    );
  }

  if (!(parsed.hostname in ALLOWED_HOSTNAME_REFERER)) {
    return Response.json({ error: "Domain not allowed" }, { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(imageUrl, {
      headers: {
        Referer:
          ALLOWED_HOSTNAME_REFERER[parsed.hostname] ??
          `https://${parsed.hostname}/`,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return Response.json({ error: "Failed to fetch image" }, { status: 502 });
  }

  if (!upstream.ok) {
    return Response.json(
      { error: "Upstream returned error", status: upstream.status },
      { status: upstream.status },
    );
  }

  const contentType = upstream.headers.get("Content-Type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return Response.json(
      { error: "Upstream response is not an image" },
      { status: 400 },
    );
  }

  const body = await upstream.arrayBuffer();
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
