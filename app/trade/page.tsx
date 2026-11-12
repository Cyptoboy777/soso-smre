import type { Metadata } from 'next';
import { SwapScreen } from '@/components/SwapScreen';

export const metadata: Metadata = {
  title: 'Swap',
  description: 'Prepare a SoDEX spot order, review cost and evidence, then sign it yourself.',
};

/** Alias of the home swap so older links keep working. */
export default function TradePage() {
  return <SwapScreen />;
}
