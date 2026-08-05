import { InternalDecimal, roundHalfUp } from './rounding.js'
import type { InvoMLDiscount } from './types.js'

const DISCOUNT_PATTERN = /^(\d+(\.\d+)?%|\d+(\.\d+)?)$/

/**
 * Normalise a discount value to an `InvoMLDiscount` object.
 * Accepts an already-structured object (pass-through) or a shorthand string:
 * `"10%"` → percentage discount; `"50"` → fixed amount.
 * Throws on unrecognised formats.
 */
export function parseDiscount(discount: string | InvoMLDiscount): InvoMLDiscount {
  if (typeof discount === 'object') return discount
  if (!DISCOUNT_PATTERN.test(discount)) {
    throw new Error(`Invalid discount format: "${discount}"`)
  }
  if (discount.endsWith('%')) {
    return { type: 'percentage', value: parseFloat(discount.slice(0, -1)) }
  }
  return { type: 'fixed', value: parseFloat(discount) }
}

/**
 * Compute the discount amount to subtract from `base`.
 * For `percentage` discounts, applies `base * rate / 100`.
 * For `fixed` discounts, returns `min(discount.value, abs(base))` to avoid over-discounting.
 * Returns a positive value representing the amount to deduct.
 */
export function computeDiscountAmount(discount: InvoMLDiscount, base: number, decimals = 2): number {
  if (discount.value < 0) {
    throw new Error('Discount value must be non-negative')
  }
  if (discount.type === 'percentage') {
    if (discount.value > 100) {
      throw new Error(`Percentage discount value (${discount.value}%) exceeds 100%`)
    }
    const pct = discount.value
    // Use Decimal for multiplication to avoid native float precision loss
    const amount = new InternalDecimal(base.toString())
      .times(new InternalDecimal(pct.toString()).dividedBy(100))
    return roundHalfUp(amount.toNumber(), decimals)
  }
  const absBase = Math.abs(base)
  const discVal = new InternalDecimal(discount.value.toString())
  const absBaseD = new InternalDecimal(absBase.toString())
  const cappedValue = discVal.greaterThan(absBaseD) ? absBase : discount.value
  const amount = roundHalfUp(cappedValue, decimals)
  return base < 0 ? -amount : amount
}

/** Allocate a total discount proportionally across categories based on their amounts.
 *  The last category absorbs any rounding residual (tie-breaking). */
export function allocateProportionally(
  categoryAmounts: number[],
  totalDiscount: number,
  subtotal: number,
  round: (v: number) => number,
): number[] {
  const result: number[] = []
  // Use Decimal accumulator to avoid float precision loss when summing allocated amounts
  let allocated = new InternalDecimal(0)

  for (let idx = 0; idx < categoryAmounts.length; idx++) {
    if (idx === categoryAmounts.length - 1) {
      result.push(round(new InternalDecimal(totalDiscount.toString()).minus(allocated).toNumber()))
    } else {
      // Keep proportion as Decimal through the multiplication to avoid float round-trip
      const proportion = subtotal !== 0
        ? new InternalDecimal(categoryAmounts[idx].toString()).dividedBy(subtotal)
        : new InternalDecimal(0)
      const catDiscount = round(new InternalDecimal(totalDiscount.toString()).times(proportion).toNumber())
      result.push(catDiscount)
      allocated = allocated.plus(catDiscount)
    }
  }

  return result
}
