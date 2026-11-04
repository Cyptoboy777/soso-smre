import type { Metadata } from 'next';
import { OnboardingClient } from '@/components/OnboardingClient';

export const metadata: Metadata = {
  title: 'Start',
  description:
    'Connect wallet, approve FlowSentinel builder fee with disclosure, and take a guided first testnet trade.',
};

export default function StartPage() {
  return <OnboardingClient />;
}
