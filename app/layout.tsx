import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';
import { FirebaseProvider } from '@/components/FirebaseProvider';
import WalletErrorSuppressor from '@/components/WalletErrorSuppressor';
import { Web3Provider } from '@/components/Web3Provider';

export const metadata: Metadata = {
  title: 'SoSo SMRE — Smart Money Research Engine',
  description: 'AI-powered crypto trading intelligence. Gemini 2.5 Flash + Groq LLaMA 3.3',
  applicationName: 'SoSo SMRE',
  appleWebApp: { title: 'SoSo SMRE', statusBarStyle: 'black-translucent', capable: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        {/* Inline SVG favicon — shows the SoSo hexagon logo in browser tab */}
        <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M32 4 56 18v28L32 60 8 46V18L32 4Z' fill='%23ffffff'/%3E%3Cpath d='M20 18h24v6H20v-6zm0 6h6v6h-6v-6zm0 6h24v6H20v-6zm18 6h6v6h-6v-6zm-18 6h24v6H20v-6z' fill='%23000000'/%3E%3Crect x='38' y='32' width='10' height='10' fill='%2300e5ff' rx='1'/%3E%3C/svg%3E" />
        <link rel="apple-touch-icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='12' fill='%23000'/%3E%3Cpath d='M32 4 56 18v28L32 60 8 46V18L32 4Z' fill='%23ffffff'/%3E%3Cpath d='M20 18h24v6H20v-6zm0 6h6v6h-6v-6zm0 6h24v6H20v-6zm18 6h6v6h-6v-6zm-18 6h24v6H20v-6z' fill='%23000000'/%3E%3Crect x='38' y='32' width='10' height='10' fill='%2300e5ff' rx='1'/%3E%3C/svg%3E" />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body style={{ background: '#000', color: '#fff', minHeight: '100vh', overflow: 'hidden' }}>
        <WalletErrorSuppressor />
        <Web3Provider>
          <FirebaseProvider>
            <AppShell>{children}</AppShell>
          </FirebaseProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
