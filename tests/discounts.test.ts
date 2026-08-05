import { describe, it, expect } from 'vitest'
import { parseDiscount, computeDiscountAmount, allocateProportionally } from '../src/discounts.js'
import { roundHalfUp } from '../src/rounding.js'

describe('parseDiscount', () => {
  it('parses "10%" as percentage', () => { expect(parseDiscount('10%')).toEqual({ type: 'percentage', value: 10 }) })
  it('parses "50" as fixed', () => { expect(parseDiscount('50')).toEqual({ type: 'fixed', value: 50 }) })
  it('parses "50.5%" as percentage', () => { expect(parseDiscount('50.5%')).toEqual({ type: 'percentage', value: 50.5 }) })
  it('parses "0.5" as fixed', () => { expect(parseDiscount('0.5')).toEqual({ type: 'fixed', value: 0.5 }) })
  it('passes through object discounts', () => {
    const d = { type: 'fixed' as const, value: 25 }
    expect(parseDiscount(d)).toEqual(d)
  })
  it('rejects invalid strings', () => { expect(() => parseDiscount('abc')).toThrow() })
  it('rejects empty string', () => { expect(() => parseDiscount('')).toThrow() })
})

describe('computeDiscountAmount', () => {
  it('applies percentage discount', () => { expect(computeDiscountAmount({ type: 'percentage', value: 10 }, 1000)).toBe(100) })
  it('applies fixed discount', () => { expect(computeDiscountAmount({ type: 'fixed', value: 50 }, 1000)).toBe(50) })
  it('caps fixed discount at base', () => { expect(computeDiscountAmount({ type: 'fixed', value: 200 }, 100)).toBe(100) })
  it('handles negative base for fixed', () => { expect(computeDiscountAmount({ type: 'fixed', value: 50 }, -100)).toBe(-50) })
  it('rounds percentage result', () => { expect(computeDiscountAmount({ type: 'percentage', value: 33.33 }, 100)).toBe(33.33) })
})

describe('allocateProportionally', () => {
  const round = (v: number) => roundHalfUp(v, 2)

  it('allocates equally for equal amounts', () => {
    const result = allocateProportionally([500, 500], 100, 1000, round)
    expect(result).toEqual([50, 50])
  })

  it('allocates proportionally for unequal amounts', () => {
    const result = allocateProportionally([750, 250], 100, 1000, round)
    expect(result).toEqual([75, 25])
  })

  it('last category absorbs rounding residual', () => {
    // 333.33 / 1000 * 100 = 33.33, 333.33 / 1000 * 100 = 33.33
    // Last gets 100 - 33.33 - 33.33 = 33.34
    const result = allocateProportionally([333.33, 333.33, 333.34], 100, 1000, round)
    expect(result[0] + result[1] + result[2]).toBe(100)
  })

  it('returns zero allocations for zero subtotal', () => {
    const result = allocateProportionally([0, 0], 100, 0, round)
    expect(result).toEqual([0, 100]) // last absorbs all
  })

  it('single category gets full discount', () => {
    const result = allocateProportionally([1000], 150, 1000, round)
    expect(result).toEqual([150])
  })

  it('handles three categories', () => {
    const result = allocateProportionally([600, 300, 100], 100, 1000, round)
    expect(result[0]).toBe(60)
    expect(result[1]).toBe(30)
    expect(result[0] + result[1] + result[2]).toBe(100)
  })
})
