import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires 'unsafe-inline' for hydration scripts unless nonces are used.
      // 'unsafe-eval' is intentionally omitted — not needed in production.
      // To achieve a stricter policy, implement nonce-based CSP via middleware.
      // See: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // External image domains loaded directly by the browser via <img unoptimized>.
      // CDNs behind Cloudflare Bot Management (e.g. static.carrefour.es) can only be
      // fetched by a real browser — server-side proxying is blocked by bot scoring.
      // All other remote images go through Next.js /_next/image (covered by 'self').
      "img-src 'self' blob: data: https://static.carrefour.es https://m.media-amazon.com https://*.media-amazon.com",
      "font-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // impit is a Rust-based native module (WASM + native bindings) that Turbopack
  // cannot bundle. Mark it as external so Node.js resolves it at runtime instead.
  serverExternalPackages: ["impit"],
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  experimental: {
    browserDebugInfoInTerminal: {
      showSourceLocation: true,
      depthLimit: 5,
      edgeLimit: 100,
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.media-amazon.com" },
      { protocol: "https", hostname: "**.carrefour.es" },
      { protocol: "https", hostname: "**.elcorteingles.es" },
      { protocol: "https", hostname: "**.pccomponentes.com" },
      { protocol: "https", hostname: "**.mercadona.es" },
      { protocol: "https", hostname: "**.alcampo.es" },
      { protocol: "https", hostname: "**.lidl.es" },
      { protocol: "https", hostname: "**.mediamarkt.es" },
      { protocol: "https", hostname: "**.eroski.es" },
      { protocol: "https", hostname: "**.ahorramas.com" },
      { protocol: "https", hostname: "**.atida.com" },
      { protocol: "https", hostname: "**.dosfarma.com" },
      { protocol: "https", hostname: "**.farmavazquez.com" },
      { protocol: "https", hostname: "**.gadisline.com" },
      { protocol: "https", hostname: "maspanales.com" },
      { protocol: "https", hostname: "viandvi.es" },
      { protocol: "https", hostname: "www.familiaonline.es" },
      { protocol: "https", hostname: "**.imgix.net" },
      { protocol: "https", hostname: "prod-mercadona.imgix.net" },
      { protocol: "https", hostname: "tienda.mercadona.es" },
      { protocol: "https", hostname: "cdn2.primor.eu" },
      { protocol: "https", hostname: "static.carrefour.es" },
      { protocol: "https", hostname: "static.carrefour.es/" },
      { protocol: "https", hostname: "www.aldi.es" },
      { protocol: "https", hostname: "cdn-bm.aktiosdigitalservices.com" },
      { protocol: "https", hostname: "froiz.com" },
      { protocol: "https", hostname: "www.farma-vazquez.com" },
      { protocol: "https", hostname: "www.arenal.net" },
      { protocol: "https", hostname: "www.primor.eu" },
      { protocol: "https", hostname: "www.dosfarma.com" },
      { protocol: "https", hostname: "www.atida.com" },
      { protocol: "https", hostname: "www.farmaciasdirect.com" },
      { protocol: "https", hostname: "viandvi.es" },
      { protocol: "https", hostname: "www.arenal.com" },
      { protocol: "https", hostname: "nappy.es" },
    ],
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
