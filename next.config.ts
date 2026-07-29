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
      "script-src-elem 'self' 'unsafe-inline'", // PDF.js worker from local public dir (no CDN needed)
      "style-src 'self' 'unsafe-inline'", // Tailwind requires inline styles
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      "font-src 'self'",
      "connect-src 'self' ws: wss: https:",
      "worker-src 'self' blob:", // PDF.js worker needs blob: URLs
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
  // FIX: Prevent infinite Fast Refresh loop caused by webpack's file watcher
  // detecting changes in the .next build output directory, dev.log, and other
  // non-source paths. The default ignored regex in Next.js's webpack-config.js
  // excludes .next/node_modules/.git, but using a RegExp function here gives
  // explicit control over what the watcher tracks — only source paths.
  webpack: (config, { dev }) => {
    if (dev) {
      // Use a RegExp that covers .next, .git, node_modules, plus project-root
      // non-source paths that are written to continuously (dev.log, mini-services, etc.)
      config.watchOptions = {
        aggregateTimeout: 300,
        ignored: /\.(next|git)|(node_modules)|(dev\.log)|(server\.log)|(mini-services)|(\/db\/)|(\/download\/)|(\/skills\/)|(\/scripts\/)|(\/e2e\/)|(\/examples\/)|(browser-test\.png)|(screenshot-.*\.png)|(\/agent-ctx\/)|(worklog\.md)|(keep-alive\.sh)|(run-server\.sh)/,
      };
    }
    return config;
  },
};

export default nextConfig;
