/** @type {import('next').NextConfig} */
const API_UPSTREAMS = (
  process.env.API_UPSTREAMS ??
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001'
)
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

// When the gateway is running, /api traffic is proxied through its load
// balanced pool (API_PROXY_TARGET is set by scripts/stack.sh). Without a
// gateway, fall back to the first API upstream directly.
const API_INTERNAL_URL = (
  process.env.API_PROXY_TARGET?.trim().replace(/\/$/, '') ||
  API_UPSTREAMS[0] ||
  'http://localhost:3001'
);

const nextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // The edge gateway owns compression when explicitly wired by stack.sh.
  // Direct Next.js deployments retain Next's built-in gzip support.
  compress: process.env.EDGE_COMPRESSION_ENABLED !== '1',
  reactStrictMode: true,
  transpilePackages: ['@sfcc/shared'],
  async redirects() {
    return [
      {
        source: '/deployment-center/releases',
        destination: '/deployment-center/azure',
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_INTERNAL_URL}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
