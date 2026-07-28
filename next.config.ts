import type { NextConfig } from "next";

// ============================================================
// MODUL 37.1-37.2: Security Headers — applied to ALL responses
// CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
// ============================================================

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // 37.1 — CSP header (strict)
  // Production: add nonce-based script-src. Development allows eval for HMR.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // 'unsafe-inline' required for Next.js RSC flight data (__next_f.push); 'unsafe-eval' needed for dev HMR
      "style-src 'self' 'unsafe-inline'", // Tailwind requires inline styles
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      "font-src 'self'",
      "connect-src 'self' ws: wss: https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Production builds use --webpack flag explicitly (Next.js 16 defaults to Turbopack)
  // Dev server also uses --webpack (Turbopack causes 2.8GB RSS → OOM on 4GB sandbox)
  // Setting turbopack: undefined means no Turbopack config, --webpack flag overrides
  turbopack: undefined,
  // 37 — Apply security headers to ALL routes
  headers: async () => {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
