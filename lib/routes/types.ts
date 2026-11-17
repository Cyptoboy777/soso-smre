export type RouteProvider = 'relay' | 'lifi';

export type QuoteInput = {
  user: string;
  recipient: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  amount: string;
  originToken: string;
  destinationToken: string;
  destinationSodexChain: string;
  purpose?: 'fund' | 'onward';
};

export type RouteTx = {
  from?: string;
  to: string;
  data?: string;
  value?: string;
  chainId: number;
  gas?: string;
  gasPrice?: string;
};

export type RouteSignature = {
  kind: 'eip191' | 'eip712' | 'unknown';
  message?: string;
  typedData?: string;
};

export type RouteStep = {
  kind: 'transaction' | 'signature' | 'manual';
  chainId: number;
  action: string;
  description: string;
  tx?: RouteTx;
  signature?: RouteSignature;
};

export type NormalizedQuote = {
  provider: RouteProvider;
  requestId?: string;
  steps: RouteStep[];
  feeUsd: number | null;
  etaSec: number | null;
  outAmount: string;
  outAmountRaw: string;
  outDecimals: number;
  outToken: string;
  minOut: string;
  minOutRaw: string;
  originChainId: number;
  originCurrency: string;
  originToken: string;
  inAmountRaw: string;
  destinationChainId: number;
  destinationSodexChain: string;
  destinationToken: string;
  recipient: string;
  appFeeUsd: number | null;
  appFeeBps: number;
};

export type RouteStatusValue = 'waiting' | 'depositing' | 'pending' | 'success' | 'failure' | 'refund';

export type NormalizedStatus = {
  provider: RouteProvider;
  status: RouteStatusValue;
  txHash?: string;
  destTxHash?: string;
};

export const FRIENDLY_NO_ROUTE = 'No route found right now. Try another amount or token.';
export const FRIENDLY_BAD_RECIPIENT = 'Recipient must be your own wallet.';
export const FRIENDLY_BAD_INPUT = 'That request is not valid. Check the token, chain and amount.';
export const FRIENDLY_RATE = 'Too many route requests. Please wait a minute and try again.';
export const ESTIMATE_NOTE = 'Estimate, not a guarantee. Fees and time can change.';
export const ROUTE_LS_KEY = 'soswap.routes.v1';
