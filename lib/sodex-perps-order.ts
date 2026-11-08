/**
 * Perps order payloads. Field order follows sodex-go-sdk-public
 * perps/types/new_order_request.go at 548dfd4 (MIT, Sodex Tech).
 * Enum integers follow common/enums in that commit. This file does not vendor the Go module.
 * Domain name is "futures". Action names: newOrder, cancelOrder, replaceOrder, modifyOrder.
 */

import { keccak256, toHex, type Hex } from "viem";
import {
  buildSpotExchangeTypedData,
  getBuilderConfig,
  networkChainId,
  type BuilderParams,
  type SodexNetworkLabel,
} from "@/lib/sodex-builder";

export const PERPS_ENUM = {
  sideBuy: 1,
  sideSell: 2,
  typeLimit: 1,
  typeMarket: 2,
  tifGtc: 1,
  tifIoc: 3,
  tifGtx: 4,
  modifierNormal: 1,
  modifierStop: 2,
  modifierBracket: 3,
  modifierAttached: 4,
  stopLoss: 1,
  takeProfit: 2,
  triggerMark: 2,
  positionBoth: 1,
  positionLong: 2,
  positionShort: 3,
} as const;

export type PerpsSide = "buy" | "sell";
export type PositionSide = "both" | "long" | "short";

function sideNum(side: PerpsSide): number {
  return side === "buy" ? PERPS_ENUM.sideBuy : PERPS_ENUM.sideSell;
}

function positionNum(side: PositionSide): number {
  if (side === "long") return PERPS_ENUM.positionLong;
  if (side === "short") return PERPS_ENUM.positionShort;
  return PERPS_ENUM.positionBoth;
}

function decimal(value: string, label: string): string {
  const text = value.trim();
  if (!/^\d+(\.\d+)?$/.test(text) || Number(text) <= 0) {
    throw new Error(`Enter a valid ${label}.`);
  }
  return text;
}

type RawOrder = Record<string, unknown>;

function baseOrder(input: {
  clOrdID: string;
  modifier: number;
  side: PerpsSide;
  type: "limit" | "market";
  reduceOnly: boolean;
  positionSide: PositionSide;
  price?: string;
  quantity?: string;
  stopPrice?: string;
  stopType?: number;
}): RawOrder {
  const tif = input.type === "market" ? PERPS_ENUM.tifIoc : PERPS_ENUM.tifGtc;
  const order: RawOrder = {
    clOrdID: input.clOrdID.slice(0, 36),
    modifier: input.modifier,
    side: sideNum(input.side),
    type: input.type === "limit" ? PERPS_ENUM.typeLimit : PERPS_ENUM.typeMarket,
    timeInForce: tif,
  };
  if (input.type === "limit") {
    order.price = decimal(input.price ?? "", "price");
    order.quantity = decimal(input.quantity ?? "", "size");
  } else if (input.quantity) {
    order.quantity = decimal(input.quantity, "size");
  }
  if (input.stopPrice) {
    order.stopPrice = decimal(input.stopPrice, "stop price");
    order.stopType = input.stopType;
    order.triggerType = PERPS_ENUM.triggerMark;
  }
  order.reduceOnly = input.reduceOnly;
  order.positionSide = positionNum(input.positionSide);
  return order;
}

export function perpsNewOrderParams(input: {
  accountId: number;
  symbolId: number;
  orders: RawOrder[];
  builder: BuilderParams | null;
}): Record<string, unknown> {
  const params: Record<string, unknown> = {
    accountID: input.accountId,
    symbolID: input.symbolId,
    orders: input.orders,
  };
  if (input.builder) params.builder = { id: input.builder.id, fee: input.builder.fee };
  return params;
}

export function normalPerpsOrder(input: {
  clOrdID: string;
  side: PerpsSide;
  type: "limit" | "market";
  price?: string;
  quantity: string;
  positionSide?: PositionSide;
}): RawOrder {
  return baseOrder({
    ...input,
    modifier: PERPS_ENUM.modifierNormal,
    reduceOnly: false,
    positionSide: input.positionSide ?? "both",
  });
}

export function reduceOnlyStop(input: {
  clOrdID: string;
  side: PerpsSide;
  stopPrice: string;
  stopKind: "stop-loss" | "take-profit";
  quantity?: string;
  positionSide?: PositionSide;
}): RawOrder {
  return baseOrder({
    clOrdID: input.clOrdID,
    modifier: PERPS_ENUM.modifierStop,
    side: input.side,
    type: "market",
    reduceOnly: true,
    positionSide: input.positionSide ?? "both",
    quantity: input.quantity,
    stopPrice: input.stopPrice,
    stopType: input.stopKind === "take-profit" ? PERPS_ENUM.takeProfit : PERPS_ENUM.stopLoss,
  });
}

/** Entry plus one or two reduce-only attached stops. Docs require 2 or 3 orders. */
export function bracketOrders(input: {
  entryId: string;
  side: PerpsSide;
  type: "limit" | "market";
  price?: string;
  quantity: string;
  takeProfit?: string;
  stopLoss?: string;
  positionSide?: PositionSide;
}): RawOrder[] {
  if (!input.takeProfit && !input.stopLoss) {
    throw new Error("A bracket needs a take-profit, a stop-loss, or both.");
  }
  const exit: PerpsSide = input.side === "buy" ? "sell" : "buy";
  const entryPrice = input.type === "limit" ? Number(input.price) : null;
  if (input.takeProfit && entryPrice && input.side === "buy" && Number(input.takeProfit) <= entryPrice) {
    throw new Error("A long take-profit must be above the entry.");
  }
  if (input.stopLoss && entryPrice && input.side === "buy" && Number(input.stopLoss) >= entryPrice) {
    throw new Error("A long stop-loss must be below the entry.");
  }
  if (input.takeProfit && entryPrice && input.side === "sell" && Number(input.takeProfit) >= entryPrice) {
    throw new Error("A short take-profit must be below the entry.");
  }
  if (input.stopLoss && entryPrice && input.side === "sell" && Number(input.stopLoss) <= entryPrice) {
    throw new Error("A short stop-loss must be above the entry.");
  }
  const orders: RawOrder[] = [
    baseOrder({
      clOrdID: input.entryId,
      modifier: PERPS_ENUM.modifierBracket,
      side: input.side,
      type: input.type,
      reduceOnly: false,
      positionSide: input.positionSide ?? "both",
      price: input.price,
      quantity: input.quantity,
    }),
  ];
  if (input.takeProfit) {
    orders.push(
      baseOrder({
        clOrdID: `${input.entryId}-tp`.slice(0, 36),
        modifier: PERPS_ENUM.modifierAttached,
        side: exit,
        type: "market",
        reduceOnly: true,
        positionSide: input.positionSide ?? "both",
        quantity: input.quantity,
        stopPrice: input.takeProfit,
        stopType: PERPS_ENUM.takeProfit,
      }),
    );
  }
  if (input.stopLoss) {
    orders.push(
      baseOrder({
        clOrdID: `${input.entryId}-sl`.slice(0, 36),
        modifier: PERPS_ENUM.modifierAttached,
        side: exit,
        type: "market",
        reduceOnly: true,
        positionSide: input.positionSide ?? "both",
        quantity: input.quantity,
        stopPrice: input.stopLoss,
        stopType: PERPS_ENUM.stopLoss,
      }),
    );
  }
  return orders;
}

export function hashAction(type: string, params: Record<string, unknown>): Hex {
  return keccak256(toHex(JSON.stringify({ type, params })));
}

export function futuresTypedData(network: SodexNetworkLabel, payloadHash: Hex, nonce: bigint) {
  const typed = buildSpotExchangeTypedData({ network, payloadHash, nonce });
  return { ...typed, domain: { ...typed.domain, name: "futures" as const, chainId: networkChainId(network) } };
}

export function optionalPerpsBuilder(include: boolean): BuilderParams | null {
  const cfg = getBuilderConfig();
  if (!include) return null;
  if (cfg.builderId == null) throw new Error("App fee tagging is not available on this deployment.");
  if (cfg.builderFee > 200) throw new Error("The configured app fee is above the perps cap, so it was not added.");
  return { id: cfg.builderId, fee: cfg.builderFee };
}

export function twapParams(input: {
  accountId: number;
  symbolId: number;
  side: PerpsSide;
  quantity: string;
  minutes: number;
  reduceOnly?: boolean;
}): Record<string, unknown> {
  if (!Number.isInteger(input.minutes) || input.minutes < 5 || input.minutes > 24 * 60) {
    throw new Error("TWAP duration must be from 5 minutes to 24 hours.");
  }
  const params: Record<string, unknown> = {
    accountID: input.accountId,
    symbolID: input.symbolId,
    side: sideNum(input.side),
    quantity: decimal(input.quantity, "size"),
    minutes: input.minutes,
    randomize: false,
  };
  if (input.reduceOnly) params.reduceOnly = true;
  return params;
}

export function cancelTwapParams(accountId: number, symbolId: number, orderId: string): Record<string, unknown> {
  if (!/^[1-9]\d+$/.test(orderId) && !/^[1-9]\d*$/.test(orderId)) {
    throw new Error("That plan id cannot be cancelled from here.");
  }
  const id = Number(orderId);
  if (!Number.isSafeInteger(id)) throw new Error("That plan id cannot be cancelled from here.");
  return { accountID: accountId, symbolID: symbolId, orderID: id };
}

export function dcaParams(input: {
  accountId: number;
  symbolId: number;
  side: PerpsSide;
  amount: string;
  hour: number;
  minPrice?: string;
  maxPrice?: string;
}): Record<string, unknown> {
  if (!Number.isInteger(input.hour) || input.hour < 0 || input.hour > 23) {
    throw new Error("Choose an hour from 0 to 23 UTC.");
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 10) {
    throw new Error("Each DCA execution must be at least 10 USDC.");
  }
  const params: Record<string, unknown> = {
    accountID: input.accountId,
    symbolID: input.symbolId,
    side: sideNum(input.side),
    amount: decimal(input.amount, "amount"),
    schedule: { kind: "daily", hour: input.hour },
    randomize: false,
    immediate: false,
  };
  if (input.minPrice) params.minPrice = decimal(input.minPrice, "minimum price");
  if (input.maxPrice) params.maxPrice = decimal(input.maxPrice, "maximum price");
  return params;
}

export function perpsCancelParams(accountId: number, symbolId: number, orderId: string): Record<string, unknown> {
  const id = Number(orderId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("That order id cannot be cancelled from here.");
  return { accountID: accountId, cancels: [{ symbolID: symbolId, orderID: id }] };
}

export function perpsReplaceParams(input: {
  accountId: number;
  symbolId: number;
  clOrdID: string;
  origOrderId: string;
  price?: string;
  quantity?: string;
}): Record<string, unknown> {
  if (!input.price && !input.quantity) throw new Error("A replace needs a new price or a new size.");
  const id = Number(input.origOrderId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("That order id cannot be replaced from here.");
  const item: Record<string, unknown> = {
    symbolID: input.symbolId,
    clOrdID: input.clOrdID.slice(0, 36),
    origOrderID: id,
  };
  if (input.price) item.price = decimal(input.price, "price");
  if (input.quantity) item.quantity = decimal(input.quantity, "size");
  return { accountID: input.accountId, orders: [item] };
}

export function perpsModifyStopParams(input: {
  accountId: number;
  symbolId: number;
  orderId: string;
  stopPrice?: string;
  quantity?: string;
}): Record<string, unknown> {
  if (!input.stopPrice && !input.quantity) throw new Error("A stop change needs a new stop price or size.");
  const id = Number(input.orderId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("That order id cannot be changed from here.");
  const params: Record<string, unknown> = { accountID: input.accountId, symbolID: input.symbolId, orderID: id };
  if (input.stopPrice) params.stopPrice = decimal(input.stopPrice, "stop price");
  if (input.quantity) params.quantity = decimal(input.quantity, "size");
  return params;
}
