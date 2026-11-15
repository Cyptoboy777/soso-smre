import type { Metadata, Viewport } from 'next';
import './globals.css';
import SoSwapAI from '@/components/SoSwapAI';
import { PwaBoot } from '@/components/Pwa';

export const metadata: Metadata = {
  title: 'SoSwap — Swap on SoDEX mainnet',
  description: 'Live SoDEX markets, route preview before you sign, SoSoValue news and ETF flows. Non-custodial: you sign every order in your own wallet.',
  applicationName: 'SoSwap',
  appleWebApp: { capable: true, title: 'SoSwap', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
  openGraph: { title: 'SoSwap: swap on SoDEX mainnet', description: 'Live routes, a preview before you sign, risk-check skills. Non-custodial.', type: 'website', siteName: 'SoSwap' },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: '#000000', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SoSwapAI />
        <PwaBoot />
      </body>
    </html>
  );
}
