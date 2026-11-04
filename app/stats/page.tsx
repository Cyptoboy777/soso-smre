import type { Metadata } from 'next';
import { BuilderStatsClient } from '@/components/BuilderStatsClient';

export const metadata: Metadata = {
  title: 'Builder stats',
  description:
    'Transparent SoDEX builder fee stats for FlowSentinel Builder ID 2674. Real protocol data or a clear empty state.',
};

export default function StatsPage() {
  return <BuilderStatsClient />;
}
