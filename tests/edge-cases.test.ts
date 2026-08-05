// tests/edge-cases.test.ts — Targeted edge case tests for uncovered branches

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { calculate } from '../src/calculator.js'
import { toHTML } from '../src/html-renderer.js'
import { toMarkdown } from '../src/serializer.js'
import { validate } from '../src/validation.js'
import { fmtNum, resolveNumberFormat } from '../src/format.js'
import { applyDiscount, applyTax } from '../src/mutators.js'
import { setSchema, validateSchema } from '../src/schema.js'
import type { InvoMLDocument } from '../src/types.js'

function makeDoc(overrides: Partial<InvoMLDocument> = {}): InvoMLDocument {
  return {
    $invoml: '1.0',
    meta: { documentType: 'invoice', number: 'TEST-001', issueDate: '2026-01-15', currency: 'USD' },
    items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    ...overrides,
  }
}

// ─── Group 1: Calculator Edge Cases ──────────────────────────────────────────

describe('calculator — compound tax (line 63-75)', () => {
  it('applies all categories to full base, not per-item tax', () => {
    const doc = makeDoc({
      meta: {
        documentType: 'invoice', number: 'TEST-001', issueDate: '2026-01-15', currency: 'USD',
        tax: {
          compound: true,
          categories: [
            { id: 'federal', label: 'Federal Tax', rate: 5, default: true },
            { id: 'state', label: 'State Tax', rate: 3, default: true },
          ],
        },
      },
    })
    const totals = calculate(doc)
    expect(totals.taxDetails).toHaveLength(2)
    // Both categories apply to the full base (100), not per-item
    expect(totals.taxDetails![0]).toMatchObject({ category: 'federal', amount: 5, base: 100 })
    expect(totals.taxDetails![1]).toMatchObject({ category: 'state', amount: 3, base: 100 })
    expect(totals.taxTotal).toBe(8)
    expect(totals.total).toBe(108)
  })

  it('compound tax with withholding category reduces total', () => {
    const doc = makeDoc({
      meta: {
        documentType: 'invoice', number: 'TEST-001', issueDate: '2026-01-15', currency: 'USD',
        tax: {
          compound: true,
          categories: [
            { id: 'vat', label: 'VAT', rate: 10, default: true },
            { id: 'wh', label: 'Withholding', rate: 5, withholding: true },
          ],
        },
      },
    })
    const totals = calculate(doc)
    // VAT = 10% of 100 = 10 (taxTotal), WHT = 5% of 100 = 5 (withholdingTotal)
    // total = 100 + 10 - 5 = 105
    expect(totals.taxTotal).toBe(10)
    expect(totals.withholdingTotal).toBe(5)
    expect(totals.total).toBe(105)
  })
})

describe('calculator — inclusive multi-rate with withholding (line 76-117)', () => {
  it('backs out inclusive VAT and applies withholding separately', () => {
    const doc = makeDoc({
      meta: {
        documentType: 'invoice', number: 'TEST-001', issueDate: '2026-01-15', currency: 'USD',
        tax: {
          inclusive: true,
          categories: [
            { id: 'vat', label: 'VAT', rate: 10, default: true },
            { id: 'wh', label: 'Withholding', rate: 5, withholding: true },
          ],
        },
      },
      items: [{ description: 'Item', quantity: 1, unitPrice: 110 }],
    })
    const totals = calculate(doc)
    // inclusive: total = afterDiscounts = 110
    expect(totals.total).toBe(110)
    // VAT back-out: net = 110 / 1.1 = 100, vatTax = 10
    expect(totals.taxTotal).toBe(10)
    // WHT = 5% of afterDiscounts (110) = 5.5
    expect(totals.withholdingTotal).toBe(5.5)
    const vatDetail = totals.taxDetails?.find(t => t.category === 'vat')
    expect(vatDetail?.inclusive).toBe(true)
    const whDetail = totals.taxDetails?.find(t => t.category === 'wh')
    expect(whDetail?.inclusive).toBe(false)
  })
})

describe('calculator — exclusive multi-rate with withholding (line 118-148)', () => {
  it('deducts withholding from grand total', () => {
    const doc = makeDoc({
      meta: {
        documentType: 'invoice', number: 'TEST-001', issueDate: '2026-01-15', currency: 'USD',
        tax: {
          categories: [
            { id: 'vat', label: 'VAT', rate: 10, default: true },
            { id: 'wh', label: 'WHT', rate: 5, withholding: true },
          ],
        },
      },
    })
    const totals = calculate(doc)
    // subtotal = 100, VAT = 10, WHT = 5
    // total = 100 + 10 - 5 = 105
    expect(totals.taxTotal).toBe(10)
    expect(totals.withholdingTotal).toBe(5)
    expect(totals.total).toBe(105)
    const whDetail = totals.taxDetails?.find(t => t.category === 'wh')
    expect(whDetail?.base).toBe(100)
  })
})

describe('calculator — empty items array', () => {
  it('returns all-zero totals when items is empty', () => {
    // validate() would catch this as EMPTY_ITEMS, but calculate() itself handles it gracefully
    const doc = makeDoc({ items: [] })
    const totals = calculate(doc)
    expect(totals.subtotal).toBe(0)
    expect(totals.taxTotal).toBe(0)
    expect(totals.total).toBe(0)
    expect(totals.amountDue).toBe(0)
  })
})

describe('calculator — prepaidAmount exceeds total', () => {
  it('amountDue is negative when prepaidAmount > total (no clamping)', () => {
    const doc = makeDoc({
      items: [{ description: 'Item', quantity: 1, unitPrice: 250 }],
      prepaidAmount: 500,
    })
    const totals = calculate(doc)
    expect(totals.total).toBe(250)
    expect(totals.prepaidAmount).toBe(500)
    expect(totals.amountDue).toBe(-250)
  })
})

describe('calculator — fixed discount exceeding subtotal', () => {
  it('caps fixed discount at subtotal (never over-discounts)', () => {
    const doc = makeDoc({
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      discounts: [{ type: 'fixed', value: 200 }],
    })
    const totals = calculate(doc)
    expect(totals.subtotal).toBe(100)
    // Capped: discount applied is 100 (not 200)
    expect(totals.discountDetails![0].amount).toBe(100)
    expect(totals.afterDiscounts).toBe(0)
    expect(totals.total).toBe(0)
  })
})

describe('calculator — fractional quantities', () => {
  it('handles fractional quantity with decimal unit price correctly', () => {
    const doc = makeDoc({
      items: [{ description: 'Storage crate', quantity: 1.5, unitPrice: 33.33 }],
    })
    const totals = calculate(doc)
    // 1.5 * 33.33 = 49.995 → rounds to 50.00 (USD, 2dp, half-up)
    expect(totals.subtotal).toBe(50)
    expect(totals.total).toBe(50)
  })
})

describe('calculator — discount stacking order matters', () => {
  it('percentage(10%) then fixed(50) on 1000 gives afterDiscounts 850', () => {
    const doc = makeDoc({
      items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
      discounts: [
        { type: 'percentage', value: 10 },
        { type: 'fixed', value: 50 },
      ],
    })
    const totals = calculate(doc)
    // Step 1: 10% of 1000 = 100, running = 900
    // Step 2: fixed 50 of 900 = 50, running = 850
    expect(totals.afterDiscounts).toBe(850)
  })

  it('fixed(50) then percentage(10%) on 1000 gives afterDiscounts 855', () => {
    const doc = makeDoc({
      items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
      discounts: [
        { type: 'fixed', value: 50 },
        { type: 'percentage', value: 10 },
      ],
    })
    const totals = calculate(doc)
    // Step 1: fixed 50 of 1000 = 50, running = 950
    // Step 2: 10% of 950 = 95, running = 855
    expect(totals.afterDiscounts).toBe(855)
  })

  it('discount stacking order produces different results', () => {
    const pctFirst = makeDoc({
      items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
      discounts: [{ type: 'percentage', value: 10 }, { type: 'fixed', value: 50 }],
    })
    const fixedFirst = makeDoc({
      items: [{ description: 'Item', quantity: 1, unitPrice: 1000 }],
      discounts: [{ type: 'fixed', value: 50 }, { type: 'percentage', value: 10 }],
    })
    expect(calculate(pctFirst).afterDiscounts).not.toBe(calculate(fixedFirst).afterDiscounts)
  })
})

describe('calculator — empty discounts array', () => {
  it('treats empty discounts array same as no discounts', () => {
    const doc = makeDoc({ discounts: [] })
    const totals = calculate(doc)
    expect(totals.afterDiscounts).toBe(100)
    expect(totals.discountDetails).toBeUndefined()
  })
})

// ─── Group 2: Format Edge Cases ───────────────────────────────────────────────

describe('fmtNum — large numbers', () => {
  it('does not produce scientific notation for 1e15', () => {
    const result = fmtNum(1e15, 0)
    expect(result).not.toContain('e')
    expect(result).not.toContain('E')
    expect(result).toContain(',')
  })
})

describe('applyIndianGrouping — early return for ≤ 3 digits (format.ts line ~100)', () => {
  it('does not add separators when integer part has exactly 3 digits', () => {
    const inFmt = resolveNumberFormat('hi')
    expect(fmtNum(999, 0, inFmt)).toBe('999')
    expect(fmtNum(100, 2, inFmt)).toBe('100.00')
  })

  it('does not add separators for 1-digit integers', () => {
    const inFmt = resolveNumberFormat('hi')
    expect(fmtNum(5, 2, inFmt)).toBe('5.00')
  })

  it('handles negative numbers with ≤ 3 digit integer part', () => {
    const inFmt = resolveNumberFormat('hi')
    expect(fmtNum(-999, 0, inFmt)).toBe('-999')
    expect(fmtNum(-50, 2, inFmt)).toBe('-50.00')
  })

  it('adds separators for 4-digit integers', () => {
    const inFmt = resolveNumberFormat('hi')
    expect(fmtNum(1000, 0, inFmt)).toBe('1,000')
  })
})

describe('resolveNumberFormat — locale variant handling', () => {
  it('handles uppercase locale tag (EN-US)', () => {
    const upper = resolveNumberFormat('EN-US')
    const lower = resolveNumberFormat('en-us')
    expect(upper).toEqual(lower)
    expect(upper.thousandsSep).toBe(',')
  })

  it('returns FORMAT_EN for empty string locale', () => {
    const fmt = resolveNumberFormat('')
    expect(fmt.thousandsSep).toBe(',')
    expect(fmt.decimalSep).toBe('.')
    expect(fmt.grouping).toBe('standard')
  })

  it('falls back to FORMAT_EN for underscore-separated locale (de_CH)', () => {
    // 'de_ch' has no exact match ('de-ch' uses dash) and 'de_ch'.startsWith('de-') is false
    // so the 'de' prefix entry does NOT match — falls all the way back to FORMAT_EN
    const fmt = resolveNumberFormat('de_CH')
    expect(fmt.thousandsSep).toBe(',')
    expect(fmt.decimalSep).toBe('.')
    expect(fmt.grouping).toBe('standard')
  })
})

// ─── Group 3: HTML Renderer Edge Cases ────────────────────────────────────────

describe('toHTML — fixed discount object (html-renderer.ts line ~115)', () => {
  it('renders fixed discount value with currency formatting', () => {
    const doc = makeDoc({
      items: [{ description: 'Item', quantity: 1, unitPrice: 100, discount: { type: 'fixed', value: 25 } }],
    })
    const html = toHTML(doc)
    // Fixed discount uses fmt(item.discount.value) — "25.00" for USD
    expect(html).toContain('25.00')
  })

  it('renders percentage discount as percentage string', () => {
    const doc = makeDoc({
      items: [{ description: 'Item', quantity: 1, unitPrice: 100, discount: { type: 'percentage', value: 15 } }],
    })
    const html = toHTML(doc)
    expect(html).toContain('15%')
  })
})

describe('toHTML — no totals', () => {
  it('does not render the totals block when doc.totals is absent', () => {
    const doc = makeDoc()
    const html = toHTML(doc)
    // CSS contains .invoml-totals class definitions, but the rendered block should not appear
    expect(html).not.toContain('data-invoml-block="totals"')
  })
})

describe('toHTML — minimal document', () => {
  it('renders without errors for a minimal document', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'MIN-001', issueDate: '2026-01-15', currency: 'USD' },
      items: [{ description: 'Storage crate', quantity: 1, unitPrice: 50 }],
    }
    expect(() => toHTML(doc)).not.toThrow()
    const html = toHTML(doc)
    expect(html).toContain('MIN-001')
  })
})

// ─── Group 4: Schema Edge Cases ───────────────────────────────────────────────

describe('setSchema + validateSchema (schema.ts lines 19-21)', () => {
  const schemaJson = JSON.parse(
    readFileSync(new URL('../invoml-v1.0.schema.json', import.meta.url).pathname, 'utf8'),
  ) as object

  it('validates a valid document after setSchema injection', () => {
    setSchema(schemaJson)
    const doc = makeDoc()
    const result = validateSchema(doc)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns errors for an invalid document after setSchema injection', () => {
    setSchema(schemaJson)
    const result = validateSchema({ $invoml: '1.0', meta: {} })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

// ─── Group 5: Mutator Edge Cases ──────────────────────────────────────────────

describe('applyTax — inclusive flag (mutators.ts line ~53)', () => {
  it('sets inclusive: true on the document tax config', () => {
    const doc = makeDoc()
    const { document: newDoc, totals } = applyTax(doc, { rate: 10, label: 'VAT', inclusive: true })
    expect(newDoc.meta.tax).toMatchObject({ inclusive: true, rate: 10, label: 'VAT' })
    // Inclusive: total = afterDiscounts (price already includes tax)
    expect(totals.total).toBe(100)
  })

  it('defaults inclusive to false when not provided', () => {
    const doc = makeDoc()
    const { document: newDoc } = applyTax(doc, { rate: 10, label: 'VAT' })
    expect((newDoc.meta.tax as { inclusive?: boolean })?.inclusive).toBe(false)
  })
})

describe('applyDiscount — stacking', () => {
  it('stacks multiple invoice-level discounts', () => {
    const doc = makeDoc()
    const { document: doc1 } = applyDiscount(doc, { type: 'fixed', value: 10, label: 'First' })
    const { document: doc2, totals } = applyDiscount(doc1, { type: 'fixed', value: 5, label: 'Second' })
    expect(doc2.discounts).toHaveLength(2)
    // cascading: 100 - 10 = 90, then 90 - 5 = 85
    expect(totals.afterDiscounts).toBe(85)
  })
})

// ─── Group 6: Serializer Edge Cases ───────────────────────────────────────────

describe('toMarkdown — item-level discount as object (serializer.ts lines 96-97)', () => {
  it('renders percentage discount object as "N%"', () => {
    const doc = makeDoc({
      items: [{ description: 'Item', quantity: 1, unitPrice: 100, discount: { type: 'percentage', value: 10 } }],
    })
    const md = toMarkdown(doc)
    expect(md).toContain('10%')
  })

  it('renders fixed discount object as plain number string', () => {
    const doc = makeDoc({
      items: [{ description: 'Item', quantity: 1, unitPrice: 100, discount: { type: 'fixed', value: 50 } }],
    })
    const md = toMarkdown(doc)
    expect(md).toContain('50')
  })
})

// ─── Group 7: Validation Edge Cases ───────────────────────────────────────────

describe('validate — LARGE_TOTAL threshold', () => {
  it('does not warn when total equals threshold exactly', () => {
    const doc = makeDoc({
      items: [{ description: 'Item', quantity: 1, unitPrice: 10_000_000 }],
    })
    const result = validate(doc)
    const warning = result.issues.find(i => i.code === 'LARGE_TOTAL')
    expect(warning).toBeUndefined()
  })

  it('warns when total exceeds threshold by 1', () => {
    const doc = makeDoc({
      items: [{ description: 'Item', quantity: 1, unitPrice: 10_000_001 }],
    })
    const result = validate(doc)
    const warning = result.issues.find(i => i.code === 'LARGE_TOTAL')
    expect(warning).toBeDefined()
    expect(warning?.level).toBe('warning')
  })
})

describe('validate — calculate throws (validation.ts catch block line ~181)', () => {
  it('does not crash and skips LARGE_TOTAL when calculate throws', () => {
    // TaxFull with no default category + item with no taxCategory → resolveCategory throws
    const doc = makeDoc({
      meta: {
        documentType: 'invoice', number: 'TEST-001', issueDate: '2026-01-15', currency: 'USD',
        tax: {
          categories: [{ id: 'special', label: 'Special', rate: 10 }], // no default: true
        },
      },
    })
    // validate should not throw
    const result = validate(doc)
    expect(result).toBeDefined()
    // calculate threw, so no LARGE_TOTAL warning is produced
    expect(result.issues.find(i => i.code === 'LARGE_TOTAL')).toBeUndefined()
  })
})

// ─── Group 8: Markdown Ordered List ───────────────────────────────────────────

describe('processMarkdown — ordered list (markdown.ts line ~55)', () => {
  it('renders ordered list items in notes as <ol><li>', () => {
    const doc = makeDoc({
      notes: '1. First item\n2. Second item\n3. Third item',
    })
    const html = toHTML(doc)
    expect(html).toContain('<ol>')
    expect(html).toContain('<li>')
    expect(html).toContain('First item')
    expect(html).toContain('Second item')
  })
})
