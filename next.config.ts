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
      "img-src 'self' blob: data:",
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
    ],
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};

export default nextConfig;
