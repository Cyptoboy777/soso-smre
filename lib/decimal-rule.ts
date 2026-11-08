/**
 * Decimal checks for SoDEX price, quantity, and notional filters.
 * Rejects values that do not fit. Does not round a number the user will sign.
 * Rules: https://docs.sodex.com/for-developers/api-reference/trading-api/rest-v1/sodex-rest-spot-api.md
 */

export type SymbolFilters = {
  pricePrecision?: number;
  quantityPrecision?: number;
  tickSize?: string;
  stepSize?: string;
  minQuantity?: string;
  maxQuantity?: string;
  minNotional?: string;
  maxNotional?: string;
  minPrice?: string;
  maxPrice?: string;
};

export type FilterIssue = { field: "price" | "quantity" | "notional"; message: string };

const DECIMAL = /^\d+(\.\d+)?$/;

export function isDecimalString(value: string): boolean {
  return DECIMAL.test(value.trim());
}

function fracDigits(value: string): number {
  const trimmed = value.trim().replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  const dot = trimmed.indexOf(".");
  return dot === -1 ? 0 : trimmed.length - dot - 1;
}

function scaleOf(values: string[]): number {
  return values.reduce((max, value) => Math.max(max, fracDigits(value)), 0);
}

/** Integer scaled by 10^scale. Null when the string is not a finite decimal. */
export function toScaled(value: string, scale: number): bigint | null {
  const raw = value.trim();
  if (!DECIMAL.test(raw) || scale < 0 || scale > 18) return null;
  const [whole, frac = ""] = raw.split(".");
  if (frac.length > scale && /[1-9]/.test(frac.slice(scale))) return null;
  const padded = (frac + "0".repeat(scale)).slice(0, scale);
  return BigInt(whole) * BigInt(10) ** BigInt(scale) + BigInt(padded || "0");
}

export function isMultiple(value: string, step: string): boolean {
  if (!isDecimalString(value) || !isDecimalString(step)) return false;
  if (toScaled(step, scaleOf([step])) === BigInt(0)) return false;
  const scale = scaleOf([value, step]);
  const left = toScaled(value, scale);
  const right = toScaled(step, scale);
  if (left == null || right == null || right === BigInt(0)) return false;
  return left % right === BigInt(0);
}

export function compareDecimal(left: string, right: string): number | null {
  const scale = scaleOf([left, right]);
  const a = toScaled(left, scale);
  const b = toScaled(right, scale);
  if (a == null || b == null) return null;
  return a === b ? 0 : a > b ? 1 : -1;
}

export function multiplyDecimal(left: string, right: string): string | null {
  if (!isDecimalString(left) || !isDecimalString(right)) return null;
  const scale = scaleOf([left]) + scaleOf([right]);
  const a = toScaled(left, scaleOf([left]));
  const b = toScaled(right, scaleOf([right]));
  if (a == null || b == null) return null;
  const product = a * b;
  if (scale === 0) return product.toString();
  const text = product.toString().padStart(scale + 1, "0");
  const cut = text.length - scale;
  const body = `${text.slice(0, cut)}.${text.slice(cut)}`.replace(/\.?0+$/, "");
  return body.length ? body : "0";
}

export function parseSymbolFilters(row: Record<string, unknown> | null | undefined): {
  filters: SymbolFilters;
  known: boolean;
} {
  if (!row) return { filters: {}, known: false };
  const filters: SymbolFilters = {};
  const num = (key: keyof SymbolFilters) => {
    const value = row[key];
    if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 18) {
      filters[key] = value as never;
    }
  };
  const dec = (key: keyof SymbolFilters) => {
    const value = row[key];
    if (typeof value === "string" && isDecimalString(value)) filters[key] = value as never;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      filters[key] = String(value) as never;
    }
  };
  num("pricePrecision");
  num("quantityPrecision");
  dec("tickSize");
  dec("stepSize");
  dec("minQuantity");
  dec("maxQuantity");
  dec("minNotional");
  dec("maxNotional");
  dec("minPrice");
  dec("maxPrice");
  return { filters, known: Object.keys(filters).length > 0 };
}

export function checkOrderFilters(input: {
  price?: string;
  quantity?: string;
  notional?: string;
  filters: SymbolFilters;
  filtersKnown: boolean;
}): { ok: boolean; filtersKnown: boolean; issues: FilterIssue[] } {
  if (!input.filtersKnown) return { ok: true, filtersKnown: false, issues: [] };
  const issues: FilterIssue[] = [];
  const { filters } = input;
  if (input.price && isDecimalString(input.price)) {
    if (filters.pricePrecision != null && fracDigits(input.price) > filters.pricePrecision) {
      issues.push({ field: "price", message: "Price has more decimals than this market allows." });
    }
    if (filters.tickSize && compareDecimal(filters.tickSize, "0") === 1 && !isMultiple(input.price, filters.tickSize)) {
      issues.push({ field: "price", message: "Price is not a multiple of the market tick." });
    }
    if (filters.minPrice && compareDecimal(filters.minPrice, "0") === 1 && compareDecimal(input.price, filters.minPrice) === -1) {
      issues.push({ field: "price", message: "Price is below the market minimum." });
    }
    if (filters.maxPrice && compareDecimal(filters.maxPrice, "0") === 1 && compareDecimal(input.price, filters.maxPrice) === 1) {
      issues.push({ field: "price", message: "Price is above the market maximum." });
    }
  }
  if (input.quantity && isDecimalString(input.quantity)) {
    if (filters.quantityPrecision != null && fracDigits(input.quantity) > filters.quantityPrecision) {
      issues.push({ field: "quantity", message: "Size has more decimals than this market allows." });
    }
    if (filters.stepSize && compareDecimal(filters.stepSize, "0") === 1 && !isMultiple(input.quantity, filters.stepSize)) {
      issues.push({ field: "quantity", message: "Size is not a multiple of the market step." });
    }
    if (filters.minQuantity && compareDecimal(filters.minQuantity, "0") === 1 && compareDecimal(input.quantity, filters.minQuantity) === -1) {
      issues.push({ field: "quantity", message: "Size is below the market minimum." });
    }
    if (filters.maxQuantity && compareDecimal(filters.maxQuantity, "0") === 1 && compareDecimal(input.quantity, filters.maxQuantity) === 1) {
      issues.push({ field: "quantity", message: "Size is above the market maximum." });
    }
  }
  if (input.notional && isDecimalString(input.notional)) {
    if (filters.minNotional && compareDecimal(filters.minNotional, "0") === 1 && compareDecimal(input.notional, filters.minNotional) === -1) {
      issues.push({ field: "notional", message: "Order value is below the market minimum." });
    }
    if (filters.maxNotional && compareDecimal(filters.maxNotional, "0") === 1 && compareDecimal(input.notional, filters.maxNotional) === 1) {
      issues.push({ field: "notional", message: "Order value is above the market maximum." });
    }
  }
  return { ok: issues.length === 0, filtersKnown: true, issues };
}
