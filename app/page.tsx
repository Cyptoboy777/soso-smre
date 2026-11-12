import type { Metadata } from 'next';
import { SwapScreen } from '@/components/SwapScreen';

export const metadata: Metadata = {
  title: 'Swap',
  description: 'Swap on SoDEX mainnet with a live-book cost preview. Your wallet signs every order.',
};

export default function HomePage() {
  return <SwapScreen />;
}
