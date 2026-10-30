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

export const metadata: Metadata = {
  title: 'FlowSentinel — SoSoValue Wave 3',
  description:
    'AI one-person fund desk: SoSoValue ETF flows & news → thesis → risk gate → confirmed SoDEX testnet order → public track record.',
  applicationName: 'FlowSentinel',
  icons: {
    icon: '/brand/favicon.svg',
    apple: '/brand/favicon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  width: 'device-width',
  initialScale: 1,
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
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
