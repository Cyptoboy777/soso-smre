import { ethers } from 'ethers'
import type { Network } from '@/types/sodex'
import { ENDPOINTS } from './sodex'

// ── Chain IDs per docs ────────────────────────────────────────────────────────
const CHAIN_IDS: Record<Network, number> = {
  mainnet: 286623,
  testnet: 138565,
}

// ── EIP-712 domain ────────────────────────────────────────────────────────────
function getDomain(network: Network) {
  return {
    name:              'spot',
    version:           '1',
    chainId:           CHAIN_IDS[network],
    verifyingContract: '0x0000000000000000000000000000000000000000',
  }
}

const TYPES = {
  ExchangeAction: [
    { name: 'payloadHash', type: 'bytes32' },
    { name: 'nonce',       type: 'uint64'  },
  ],
}

// ── Compute payloadHash — Keccak256(compact JSON) ─────────────────────────────
function computePayloadHash(payload: object): string {
  const json  = JSON.stringify(payload)
  const bytes = ethers.toUtf8Bytes(json)
  return ethers.keccak256(bytes)
}

// ── Build typed signature (prepend 0x01 per docs) ────────────────────────────
async function signPayload(
  wallet:       ethers.Wallet,
  payloadHash:  string,
  nonce:        number,
  network:      Network,
): Promise<string> {
  const domain  = getDomain(network)
  const message = { payloadHash, nonce }

  const sig = await wallet.signTypedData(domain, { ExchangeAction: TYPES.ExchangeAction }, message)
  return '0x01' + sig.slice(2)
}

// ── New Spot Order ─────────────────────────────────────────────────────────────
export interface SpotOrderParams {
  accountID:  number
  symbolID:   number
  clOrdID:    string
  side:       1 | 2          // 1=buy 2=sell
  type:       1 | 2 | 3     // 1=limit 2=market 3=IOC
  timeInForce: 1 | 2 | 3    // 1=GTC 2=IOC 3=FOK
  price?:     string         // DecimalString — omit for market
  quantity:   string         // DecimalString
}

export async function placeSpotOrder(
  privateKey: string,
  params:     SpotOrderParams,
  network:    Network = 'mainnet',
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    const wallet = new ethers.Wallet(privateKey)
    const nonce  = Date.now()

    const payload: object = {
      type: 'newOrder',
      params: {
        accountID: params.accountID,
        symbolID:  params.symbolID,
        orders: [{
          clOrdID:    params.clOrdID,
          modifier:   1,
          side:       params.side,
          type:       params.type,
          timeInForce: params.timeInForce,
          ...(params.price ? { price: params.price } : {}),
          quantity:   params.quantity,
          reduceOnly: false,
          positionSide: 1,
        }],
      },
    }

    const payloadHash = computePayloadHash(payload)
    const typedSig    = await signPayload(wallet, payloadHash, nonce, network)

    const body = {
      ...(payload as any).params,
      nonce,
      signature: typedSig,
    }

    const res = await fetch(`${ENDPOINTS[network].rest}/orders`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    const json = await res.json()
    if (json.code !== 0) throw new Error(json.error ?? 'Order failed')
    return { success: true, data: json.data }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
