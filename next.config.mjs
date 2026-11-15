/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';
const WC = !!process.env.NEXT_PUBLIC_WC_PROJECT_ID; // WalletConnect hosts are only allowed when it is enabled
const wcConnect = WC ? ' https://*.walletconnect.org https://*.walletconnect.com wss://*.walletconnect.org wss://*.walletconnect.com https://*.reown.com wss://*.reown.com https://*.web3modal.org https://*.web3modal.com wss://www.walletlink.org https://mainnet.valuechain.xyz' : '';
const wcImg = WC ? ' https://*.walletconnect.com https://*.walletconnect.org https://*.web3modal.org https://*.reown.com' : '';
const wcFrame = WC ? "frame-src https://verify.walletconnect.com https://verify.walletconnect.org https://secure.walletconnect.com https://secure.walletconnect.org" : "frame-src 'none'";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // token logos load from these public CDNs; wallet icons arrive as data: URIs
  `img-src 'self' data: blob: https://assets.coincap.io https://assets.parqet.com https://raw.githubusercontent.com https://cdn.jsdelivr.net https://assets.coingecko.com${wcImg}`,
  `font-src 'self' data:${WC ? ' https://fonts.reown.com' : ''}`,
  // all API traffic goes through this app's own /api routes (add the gateways only if you enable NEXT_PUBLIC_SODEX_DIRECT=1)
  `connect-src 'self'${process.env.NEXT_PUBLIC_SODEX_DIRECT === '1' ? ' https://mainnet-gw.sodex.dev https://testnet-gw.sodex.dev' : ''}${wcConnect}${isDev ? ' ws:' : ''}`,
  wcFrame,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
];
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }, { key: 'Service-Worker-Allowed', value: '/' }] },
    ];
  },
};
export default nextConfig;
