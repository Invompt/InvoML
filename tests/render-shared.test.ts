import { describe, it, expect } from 'vitest'
import { detectItemColumns } from '../src/render-shared.js'
import type { InvoMLItem } from '../src/types.js'

// ─── detectItemColumns ────────────────────────────────────────────────────────

function item(overrides: Partial<InvoMLItem> = {}): InvoMLItem {
  return { description: 'Storage crate', quantity: 1, unitPrice: 100, ...overrides }
}

describe('detectItemColumns', () => {
  // ─── No hidden set ─────────────────────────────────────────────────────────

  it('no hidden — hasUnit false when no items have unit', () => {
    const result = detectItemColumns([item()])
    expect(result.hasUnit).toBe(false)
  })

  it('no hidden — hasUnit true when at least one item has unit', () => {
    const result = detectItemColumns([item({ unit: 'boxes' })])
    expect(result.hasUnit).toBe(true)
  })

  it('no hidden — hasDiscount false when no items have discount', () => {
    const result = detectItemColumns([item()])
    expect(result.hasDiscount).toBe(false)
  })

  it('no hidden — hasDiscount true when at least one item has discount', () => {
    const result = detectItemColumns([item({ discount: '10%' })])
    expect(result.hasDiscount).toBe(true)
  })

  it('no hidden — hasTax false when no items have taxAmount', () => {
    const result = detectItemColumns([item()])
    expect(result.hasTax).toBe(false)
  })

  it('no hidden — hasTax true when at least one item has taxAmount', () => {
    const result = detectItemColumns([item({ taxAmount: 20 })])
    expect(result.hasTax).toBe(true)
  })

  it('no hidden — mixed items: some with unit, some without → hasUnit true', () => {
    const result = detectItemColumns([item(), item({ unit: 'boxes' })])
    expect(result.hasUnit).toBe(true)
  })

  it('no hidden — taxAmount of 0 is treated as present', () => {
    const result = detectItemColumns([item({ taxAmount: 0 })])
    expect(result.hasTax).toBe(true)
  })

  // ─── Empty hidden set ──────────────────────────────────────────────────────

  it('empty hidden set — same result as no hidden when items have unit', () => {
    const withHidden = detectItemColumns([item({ unit: 'boxes' })], new Set())
    const withoutHidden = detectItemColumns([item({ unit: 'boxes' })])
    expect(withHidden.hasUnit).toBe(withoutHidden.hasUnit)
    expect(withHidden.hasDiscount).toBe(withoutHidden.hasDiscount)
    expect(withHidden.hasTax).toBe(withoutHidden.hasTax)
  })

  it('empty hidden set — same result as no hidden when items have discount', () => {
    const result = detectItemColumns([item({ discount: '5%' })], new Set())
    expect(result.hasDiscount).toBe(true)
  })

  it('empty hidden set — same result as no hidden when items have tax', () => {
    const result = detectItemColumns([item({ taxAmount: 15 })], new Set())
    expect(result.hasTax).toBe(true)
  })

  // ─── Hidden "tax" ──────────────────────────────────────────────────────────

  it('hidden "tax" — hasTax is false even when items have taxAmount', () => {
    const result = detectItemColumns([item({ taxAmount: 20 })], new Set(['tax']))
    expect(result.hasTax).toBe(false)
  })

  it('hidden "tax" — does not affect hasUnit', () => {
    const result = detectItemColumns([item({ unit: 'boxes', taxAmount: 20 })], new Set(['tax']))
    expect(result.hasUnit).toBe(true)
  })

  it('hidden "tax" — does not affect hasDiscount', () => {
    const result = detectItemColumns([item({ discount: '10%', taxAmount: 20 })], new Set(['tax']))
    expect(result.hasDiscount).toBe(true)
  })

  // ─── Hidden "unit" ─────────────────────────────────────────────────────────

  it('hidden "unit" — hasUnit is false even when items have unit', () => {
    const result = detectItemColumns([item({ unit: 'boxes' })], new Set(['unit']))
    expect(result.hasUnit).toBe(false)
  })

  it('hidden "unit" — does not affect hasTax', () => {
    const result = detectItemColumns([item({ unit: 'boxes', taxAmount: 20 })], new Set(['unit']))
    expect(result.hasTax).toBe(true)
  })

  it('hidden "unit" — does not affect hasDiscount', () => {
    const result = detectItemColumns([item({ unit: 'boxes', discount: '5%' })], new Set(['unit']))
    expect(result.hasDiscount).toBe(true)
  })

  // ─── Hidden "discount" ─────────────────────────────────────────────────────

  it('hidden "discount" — hasDiscount is false even when items have discount', () => {
    const result = detectItemColumns([item({ discount: '10%' })], new Set(['discount']))
    expect(result.hasDiscount).toBe(false)
  })

  it('hidden "discount" — does not affect hasUnit', () => {
    const result = detectItemColumns([item({ unit: 'boxes', discount: '10%' })], new Set(['discount']))
    expect(result.hasUnit).toBe(true)
  })

  it('hidden "discount" — does not affect hasTax', () => {
    const result = detectItemColumns([item({ discount: '10%', taxAmount: 15 })], new Set(['discount']))
    expect(result.hasTax).toBe(true)
  })

  // ─── Multiple hidden columns ───────────────────────────────────────────────

  it('all three hidden simultaneously — all false regardless of data', () => {
    const items = [item({ unit: 'boxes', discount: '10%', taxAmount: 20 })]
    const result = detectItemColumns(items, new Set(['tax', 'unit', 'discount']))
    expect(result.hasUnit).toBe(false)
    expect(result.hasDiscount).toBe(false)
    expect(result.hasTax).toBe(false)
  })

  it('unrelated hidden entries do not affect column detection', () => {
    const items = [item({ unit: 'boxes', discount: '10%', taxAmount: 20 })]
    const result = detectItemColumns(items, new Set(['quantity', 'amount', 'description']))
    expect(result.hasUnit).toBe(true)
    expect(result.hasDiscount).toBe(true)
    expect(result.hasTax).toBe(true)
  })

  // ─── Edge cases ────────────────────────────────────────────────────────────

  it('empty items array — all false', () => {
    const result = detectItemColumns([])
    expect(result.hasUnit).toBe(false)
    expect(result.hasDiscount).toBe(false)
    expect(result.hasTax).toBe(false)
  })

  it('empty items array with hidden set — all false', () => {
    const result = detectItemColumns([], new Set(['tax', 'unit']))
    expect(result.hasUnit).toBe(false)
    expect(result.hasDiscount).toBe(false)
    expect(result.hasTax).toBe(false)
  })
})
