import { describe, it, expect } from 'vitest'
import { applyDiscount, removeDiscounts, applyTax, removeTax } from '../src/mutators.js'
import { calculate } from '../src/calculator.js'
import type { InvoMLDocument } from '../src/types.js'

const baseDoc: InvoMLDocument = {
  $invoml: '1.0',
  meta: { documentType: 'invoice', number: 'INV-001', issueDate: '2026-01-15', currency: 'USD' },
  items: [
    { description: 'Widget A', quantity: 2, unitPrice: 100 },
    { description: 'Widget B', quantity: 1, unitPrice: 50 },
  ],
}

describe('applyDiscount', () => {
  it('percentage: 10% on $250 subtotal → discount $25, total $225', () => {
    const { totals } = applyDiscount(baseDoc, { type: 'percentage', value: 10 })
    expect(totals.subtotal).toBe(250)
    expect(totals.discountDetails).toHaveLength(1)
    expect(totals.discountDetails![0].amount).toBe(25)
    expect(totals.afterDiscounts).toBe(225)
    expect(totals.total).toBe(225)
  })

  it('fixed: $30 fixed → total $220', () => {
    const { totals } = applyDiscount(baseDoc, { type: 'fixed', value: 30 })
    expect(totals.subtotal).toBe(250)
    expect(totals.discountDetails![0].amount).toBe(30)
    expect(totals.total).toBe(220)
  })

  it('preserves label in discountDetails', () => {
    const { totals } = applyDiscount(baseDoc, { type: 'percentage', value: 10, label: 'Promo10' })
    expect(totals.discountDetails![0].label).toBe('Promo10')
  })

  it('returns a document with refreshed totals and computed item amounts', () => {
    const { document, totals } = applyDiscount(baseDoc, { type: 'percentage', value: 10, label: 'Promo10' })
    expect(document.totals).toEqual(totals)
    expect(document.items[0].amount).toBe(200)
    expect(document.items[1].amount).toBe(50)
  })

  it('stacks: two discounts both appear in discountDetails (cascading)', () => {
    const step1 = applyDiscount(baseDoc, { type: 'percentage', value: 10, label: 'First' })
    const { totals } = applyDiscount(step1.document, { type: 'fixed', value: 5, label: 'Second' })
    // First: 10% of 250 = 25 → running 225; Second: fixed 5 → running 220
    expect(totals.discountDetails).toHaveLength(2)
    expect(totals.discountDetails![0].label).toBe('First')
    expect(totals.discountDetails![0].amount).toBe(25)
    expect(totals.discountDetails![1].label).toBe('Second')
    expect(totals.discountDetails![1].amount).toBe(5)
    expect(totals.total).toBe(220)
  })

  it('no-op: value: 0 produces zero discount amount, total unchanged', () => {
    const { totals } = applyDiscount(baseDoc, { type: 'percentage', value: 0 })
    expect(totals.discountDetails![0].amount).toBe(0)
    expect(totals.afterDiscounts).toBe(250)
    expect(totals.total).toBe(250)
  })

  it('no-op: fixed value: 0 also produces zero discount amount', () => {
    const { totals } = applyDiscount(baseDoc, { type: 'fixed', value: 0 })
    expect(totals.discountDetails![0].amount).toBe(0)
    expect(totals.total).toBe(250)
  })
})

describe('removeDiscounts', () => {
  it('removes applied discounts and totals match undiscounted original', () => {
    const withDiscount = applyDiscount(baseDoc, { type: 'percentage', value: 10 })
    const { totals } = removeDiscounts(withDiscount.document)
    const original = calculate(baseDoc)
    expect(totals.subtotal).toBe(original.subtotal)
    expect(totals.total).toBe(original.total)
    expect(totals.discountDetails).toBeUndefined()
  })
})

describe('applyTax', () => {
  it('exclusive 10% tax on $250 → tax $25, total $275', () => {
    const { totals } = applyTax(baseDoc, { rate: 10, label: 'VAT' })
    expect(totals.subtotal).toBe(250)
    expect(totals.taxTotal).toBe(25)
    expect(totals.total).toBe(275)
  })

  it('inclusive 10% tax on $250 → total stays $250, tax extracted', () => {
    const { totals } = applyTax(baseDoc, { rate: 10, label: 'GST', inclusive: true })
    expect(totals.total).toBe(250)
    // back-out: 250 / 1.10 = 227.27, tax = 22.73
    expect(totals.taxTotal).toBe(22.73)
    expect(totals.afterDiscounts).toBe(250)
  })

  it('rate: 0 produces zero tax, total equals subtotal', () => {
    const { totals } = applyTax(baseDoc, { rate: 0, label: 'ZeroTax' })
    expect(totals.taxTotal).toBe(0)
    expect(totals.total).toBe(250)
  })

  it('label appears in taxDetails', () => {
    const { document, totals } = applyTax(baseDoc, { rate: 10, label: 'MyTax' })
    expect(totals.taxDetails).toBeDefined()
    expect(totals.taxDetails![0].label).toBe('MyTax')
    expect(document.totals).toEqual(totals)
    expect(document.items[0].taxAmount).toBe(20)
    expect(document.items[1].taxAmount).toBe(5)
  })
})

describe('removeTax', () => {
  it('after applying tax, removeTax restores original totals', () => {
    const withTax = applyTax(baseDoc, { rate: 10, label: 'VAT' })
    const { totals } = removeTax(withTax.document)
    const original = calculate(baseDoc)
    expect(totals.subtotal).toBe(original.subtotal)
    expect(totals.taxTotal).toBe(0)
    expect(totals.total).toBe(original.total)
    expect(totals.taxDetails).toBeUndefined()
  })
})

describe('applyDiscount + applyTax combo', () => {
  it('discount first, then tax on discounted amount', () => {
    const afterDiscount = applyDiscount(baseDoc, { type: 'percentage', value: 10 })
    // afterDiscounts = 225
    const { totals } = applyTax(afterDiscount.document, { rate: 10, label: 'VAT' })
    expect(totals.afterDiscounts).toBe(225)
    expect(totals.taxTotal).toBe(22.5)
    expect(totals.total).toBe(247.5)
  })
})

describe('immutability', () => {
  it('applyDiscount does not mutate the original document', () => {
    const before = JSON.stringify(baseDoc)
    applyDiscount(baseDoc, { type: 'percentage', value: 20 })
    expect(JSON.stringify(baseDoc)).toBe(before)
  })

  it('applyTax does not mutate the original document', () => {
    const before = JSON.stringify(baseDoc)
    applyTax(baseDoc, { rate: 10, label: 'VAT' })
    expect(JSON.stringify(baseDoc)).toBe(before)
  })

  it('removeDiscounts does not mutate the input document', () => {
    const withDiscount = applyDiscount(baseDoc, { type: 'fixed', value: 10 })
    const snapshot = JSON.stringify(withDiscount.document)
    removeDiscounts(withDiscount.document)
    expect(JSON.stringify(withDiscount.document)).toBe(snapshot)
  })

  it('removeTax does not mutate the input document', () => {
    const withTax = applyTax(baseDoc, { rate: 10, label: 'VAT' })
    const snapshot = JSON.stringify(withTax.document)
    removeTax(withTax.document)
    expect(JSON.stringify(withTax.document)).toBe(snapshot)
  })
})

describe('currency precision', () => {
  it('JPY (0 decimals): applyTax rounds correctly', () => {
    const jpyDoc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'JPY-001', issueDate: '2026-01-15', currency: 'JPY' },
      items: [{ description: 'Item', quantity: 3, unitPrice: 333 }],
    }
    // subtotal = 999, 10% tax = 99.9 → rounds to 100 for JPY
    const { totals } = applyTax(jpyDoc, { rate: 10, label: 'JCT' })
    expect(totals.subtotal).toBe(999)
    expect(totals.taxTotal).toBe(100)
    expect(totals.total).toBe(1099)
  })

  it('KWD (3 decimals): applyTax has correct precision', () => {
    const kwdDoc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'KWD-001', issueDate: '2026-01-15', currency: 'KWD' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100.001 }],
    }
    // subtotal = 100.001, 10% tax = 10.000 (rounded to 3dp)
    const { totals } = applyTax(kwdDoc, { rate: 10, label: 'Tax' })
    expect(totals.subtotal).toBe(100.001)
    expect(totals.taxTotal).toBe(10)
    expect(totals.total).toBe(110.001)
  })
})
