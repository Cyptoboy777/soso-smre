import type { Metadata } from 'next';
import { HeroLanding } from '@/components/HeroLanding';
import { DeskBelowFold } from '@/components/DeskBelowFold';

export const metadata: Metadata = {
  title: 'Research desk',
  description: 'SoSoValue research desk: ETF flows, news and rule-based theses. No orders are placed here.',
};

export default function DeskPage() {
  return (
    <>
      <HeroLanding />
      <DeskBelowFold />
    </>
  );
}
