import type { Metadata } from 'next';
import { JudgeClient } from '@/components/JudgeClient';

export const metadata: Metadata = {
  title: 'Judge path · FlowSentinel',
  description: '60-second guided desk: SoSoValue data → thesis → risk gate → confirmed SoDEX testnet ticket.',
};

export default function JudgePage() {
  return <JudgeClient />;
}
