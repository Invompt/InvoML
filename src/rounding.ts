import { Decimal } from 'decimal.js'

// Library-private Decimal clone — avoids mutating the global Decimal config
// which would break consumers who also use decimal.js
export const InternalDecimal = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP })

// ISO 4217 minor units — currencies that DON'T use 2 decimal places
// IMPORTANT: Any currency added here must also be present in VALID_CURRENCIES in validation.ts
const ZERO_DECIMAL: ReadonlySet<string> = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW',
  'PYG', 'RWF', 'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

// IMPORTANT: Any currency added here must also be present in VALID_CURRENCIES in validation.ts
const THREE_DECIMAL: ReadonlySet<string> = new Set([
  'BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND',
])

/** Return the standard number of decimal places for a currency (ISO 4217 minor units). */
export function getCurrencyDecimals(currency: string): number {
  if (ZERO_DECIMAL.has(currency)) return 0
  if (THREE_DECIMAL.has(currency)) return 3
  return 2
}

/** Round `value` to `decimals` places using ROUND_HALF_UP via arbitrary-precision Decimal arithmetic. */
export function roundHalfUp(value: number | Decimal, decimals = 2): number {
  const d = new InternalDecimal(value.toString())
  return d.toDecimalPlaces(decimals, InternalDecimal.ROUND_HALF_UP).toNumber()
}
