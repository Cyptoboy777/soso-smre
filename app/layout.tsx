import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';
import { FirebaseProvider } from '@/components/FirebaseProvider';

export const metadata: Metadata = {
  title: 'SoSo Smre — Smart Money Research Engine',
  description: 'AI-powered crypto trading intelligence. Gemini 2.5 Flash + Groq LLaMA 3.3',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ background: '#000', color: '#fff', minHeight: '100vh', overflow: 'hidden' }}>
        <FirebaseProvider>
          <AppShell>{children}</AppShell>
        </FirebaseProvider>
      </body>
    </html>
  );
}
