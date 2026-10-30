import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import { Shell } from '@/components/Shell';

const sans = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-sans-loaded',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono-loaded',
  display: 'swap',
});

const site = process.env.NEXT_PUBLIC_APP_URL || 'https://flowsentinel-app.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: {
    default: 'FlowSentinel — SoSoValue Wave 3',
    template: '%s · FlowSentinel',
  },
  description:
    'AI one-person fund desk: SoSoValue ETF flows and news to a risk-gated SoDEX testnet order and a public track record. Not financial advice.',
  applicationName: 'FlowSentinel',
  keywords: [
    'FlowSentinel',
    'SoSoValue',
    'SoDEX',
    'ETF flows',
    'testnet',
    'buildathon',
  ],
  authors: [{ name: 'Crypto boy' }],
  openGraph: {
    type: 'website',
    url: site,
    title: 'FlowSentinel — Watch the flow. Act with a gate.',
    description:
      'SoSoValue data to thesis, risk gate, and confirmed SoDEX testnet order. Honest Live/Fallback labels.',
    siteName: 'FlowSentinel',
    images: [{ url: '/brand/og.svg', width: 1200, height: 630, alt: 'FlowSentinel' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FlowSentinel',
    description: 'SoSoValue flows → risk gate → SoDEX testnet. Not financial advice.',
    images: ['/brand/og.svg'],
  },
  icons: {
    icon: '/brand/favicon.svg',
    apple: '/brand/favicon.svg',
  },
  manifest: '/manifest.webmanifest',
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body
        style={
          {
            ['--font-sans' as string]: 'var(--font-sans-loaded), system-ui, sans-serif',
            ['--font-mono' as string]: 'var(--font-mono-loaded), ui-monospace, monospace',
          } as React.CSSProperties
        }
      >
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
