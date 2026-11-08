'use client';

import { ExecutionTicket } from './ExecutionTicket';
import type { Thesis } from '@/types/flow';

type Props = {
  thesis: Thesis;
  quantity: number;
  onPrefillOnlyNote?: string;
};

/** Wallet-signed SoDEX ticket. The assistant never submits this order. */
export function BuilderTradePanel({ thesis, quantity }: Props) {
  return <ExecutionTicket thesis={thesis} quantity={quantity} />;
}
