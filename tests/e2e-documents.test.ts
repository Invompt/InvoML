import { describe, it, expect } from 'vitest'
import { calculate } from '../src/calculator.js'
import { toHTML } from '../src/html-renderer.js'
import { toMarkdown } from '../src/serializer.js'
import { validate } from '../src/validation.js'
import { applyDiscount, removeDiscounts, applyTax, removeTax } from '../src/mutators.js'
import type { InvoMLDocument } from '../src/types.js'

function makeDoc(overrides: Partial<InvoMLDocument> = {}): InvoMLDocument {
  return {
    $invoml: '1.0',
    meta: { documentType: 'invoice', number: 'TEST-001', issueDate: '2026-01-15', currency: 'USD' },
    items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    ...overrides,
  }
}

function withTotals(doc: InvoMLDocument): InvoMLDocument {
  return { ...doc, totals: calculate(doc) }
}

// ── Scenario 10: Three-Decimal Currency (KWD) ────────────────────────────────

describe('scenario 10: three-decimal currency (KWD)', () => {
  const doc: InvoMLDocument = {
    $invoml: '1.0',
    meta: { documentType: 'invoice', number: 'KWD-001', issueDate: '2026-01-15', currency: 'KWD' },
    items: [{ description: 'Storage crates', quantity: 5, unitPrice: 12.345 }],
  }

  it('calculate uses 3 decimal places', () => {
    const totals = calculate(doc)
    expect(totals.subtotal).toBe(61.725)
    expect(totals.afterDiscounts).toBe(61.725)
    expect(totals.total).toBe(61.725)
    expect(totals.amountDue).toBe(61.725)
  })

  it('toHTML contains the 3-decimal amount', () => {
    const html = toHTML(withTotals(doc))
    expect(html).toContain('61.725')
  })

  it('toMarkdown contains the 3-decimal amount', () => {
    const md = toMarkdown(withTotals(doc))
    expect(md.length).toBeGreaterThan(0)
    expect(md).toContain('61.725')
  })

  it('validate returns valid', () => {
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(i => i.level === 'error')).toHaveLength(0)
  })
})

// ── Scenario 11: Credit Note ─────────────────────────────────────────────────

describe('scenario 11: credit note', () => {
  const doc: InvoMLDocument = {
    $invoml: '1.0',
    meta: {
      documentType: 'credit_note',
      number: 'CN-001',
      issueDate: '2026-01-15',
      currency: 'USD',
      creditNoteReference: 'INV-2026-001',
    },
    items: [
      { description: 'Refund - Product A', quantity: 1, unitPrice: -500 },
      { description: 'Refund - Product B', quantity: 2, unitPrice: -150 },
    ],
  }

  it('calculate returns total -800 and amountDue -800', () => {
    const totals = calculate(doc)
    expect(totals.total).toBe(-800)
    expect(totals.amountDue).toBe(-800)
  })

  it('toHTML contains CREDIT NOTE label', () => {
    const html = toHTML(withTotals(doc))
    expect(html).toContain('CREDIT NOTE')
  })

  it('toMarkdown contains CREDIT NOTE label', () => {
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('CREDIT NOTE')
    expect(md.length).toBeGreaterThan(0)
  })

  it('validate flags negative unit prices', () => {
    const result = validate(doc)
    expect(result.valid).toBe(false)
    const codes = result.issues.map(i => i.code)
    expect(codes).toContain('NEGATIVE_UNIT_PRICE')
  })
})

// ── Scenario 12: Quote with Expiry ───────────────────────────────────────────

describe('scenario 12: quote with expiry', () => {
  const doc: InvoMLDocument = {
    $invoml: '1.0',
    meta: {
      documentType: 'quote',
      number: 'QUOTE-001',
      issueDate: '2026-01-15',
      currency: 'USD',
      expiryDate: '2026-03-15',
    },
    items: [
      { description: 'Display rack', quantity: 1, unitPrice: 2000 },
      { description: 'Display rack', quantity: 1, unitPrice: 2000 },
      { description: 'Testing', quantity: 1, unitPrice: 1000 },
    ],
  }

  it('calculate returns subtotal 5000', () => {
    const totals = calculate(doc)
    expect(totals.subtotal).toBe(5000)
    expect(totals.total).toBe(5000)
    expect(totals.amountDue).toBe(5000)
  })

  it('toHTML contains QUOTE label', () => {
    const html = toHTML(withTotals(doc))
    expect(html).toContain('QUOTE')
  })

  it('toMarkdown contains QUOTE label', () => {
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('QUOTE')
    expect(md.length).toBeGreaterThan(0)
  })

  it('validate returns valid (no dueDate, no errors)', () => {
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(i => i.level === 'error')).toHaveLength(0)
  })
})

// ── Scenario 13: Receipt with Prepaid ────────────────────────────────────────

describe('scenario 13: receipt with prepaid', () => {
  const doc: InvoMLDocument = {
    $invoml: '1.0',
    meta: { documentType: 'receipt', number: 'REC-001', issueDate: '2026-01-15', currency: 'USD' },
    items: [
      { description: 'Product A', quantity: 1, unitPrice: 150 },
      { description: 'Product B', quantity: 2, unitPrice: 50 },
    ],
    prepaidAmount: 250,
  }

  it('calculate returns total 250, prepaidAmount 250, amountDue 0', () => {
    const totals = calculate(doc)
    expect(totals.total).toBe(250)
    expect(totals.prepaidAmount).toBe(250)
    expect(totals.amountDue).toBe(0)
  })

  it('toHTML renders without error and contains RECEIPT', () => {
    expect(() => toHTML(withTotals(doc))).not.toThrow()
    const html = toHTML(withTotals(doc))
    expect(html).toContain('RECEIPT')
    expect(html.length).toBeGreaterThan(0)
  })

  it('toMarkdown renders non-empty output', () => {
    const md = toMarkdown(withTotals(doc))
    expect(md.length).toBeGreaterThan(0)
  })

  it('validate returns valid', () => {
    const result = validate(doc)
    expect(result.valid).toBe(true)
  })
})

// ── Scenario 14: Large Invoice (55 items) ────────────────────────────────────

describe('scenario 14: large invoice (55 items)', () => {
  // unitPrice = i*10 for i=1..55; sum = 10 * (55*56/2) = 10 * 1540 = 15400
  const items = Array.from({ length: 55 }, (_, idx) => ({
    description: `Item ${idx + 1}`,
    quantity: 1,
    unitPrice: (idx + 1) * 10,
  }))

  const doc: InvoMLDocument = {
    $invoml: '1.0',
    meta: { documentType: 'invoice', number: 'LARGE-001', issueDate: '2026-01-15', currency: 'USD' },
    items,
  }

  it('calculate returns correct subtotal of 15400', () => {
    const totals = calculate(doc)
    expect(totals.subtotal).toBe(15400)
    expect(totals.total).toBe(15400)
    expect(totals.amountDue).toBe(15400)
  })

  it('toHTML renders all 55 items without error', () => {
    expect(() => toHTML(withTotals(doc))).not.toThrow()
    const html = toHTML(withTotals(doc))
    expect(html).toContain('Item 1')
    expect(html).toContain('Item 55')
  })

  it('toMarkdown renders non-empty output without error', () => {
    expect(() => toMarkdown(withTotals(doc))).not.toThrow()
    const md = toMarkdown(withTotals(doc))
    expect(md.length).toBeGreaterThan(0)
  })

  it('validate returns valid (15400 < LARGE_TOTAL threshold)', () => {
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(i => i.level === 'error')).toHaveLength(0)
    expect(result.issues.find(i => i.code === 'LARGE_TOTAL')).toBeUndefined()
  })
})

// ── Scenario 15: Mutator Round-Trip ──────────────────────────────────────────

describe('scenario 15: mutator round-trip', () => {
  const baseDoc = makeDoc({
    items: [
      { description: 'Product A', quantity: 1, unitPrice: 600 },
      { description: 'Product B', quantity: 1, unitPrice: 400 },
    ],
  })

  it('base doc subtotal is 1000', () => {
    const totals = calculate(baseDoc)
    expect(totals.subtotal).toBe(1000)
    expect(totals.amountDue).toBe(1000)
  })

  it('applyDiscount reduces afterDiscounts and records discount entry', () => {
    const { document: discounted, totals } = applyDiscount(baseDoc, {
      type: 'percentage',
      value: 10,
      label: '10% Promo',
    })
    expect(discounted.discounts).toBeDefined()
    expect(discounted.discounts).toHaveLength(1)
    expect(totals.afterDiscounts).toBe(900)
    expect(totals.amountDue).toBe(900)
  })

  it('applyTax after discount reflects tax in totals', () => {
    const { document: discounted } = applyDiscount(baseDoc, { type: 'percentage', value: 10, label: '10% Promo' })
    const { document: taxed, totals } = applyTax(discounted, { rate: 10, label: 'VAT' })
    expect(taxed.meta.tax).toBeDefined()
    expect(totals.taxTotal).toBe(90)
    expect(totals.total).toBe(990)
  })

  it('toHTML on discounted+taxed doc contains discount label and tax label', () => {
    const { document: discounted } = applyDiscount(baseDoc, { type: 'percentage', value: 10, label: '10% Promo' })
    const { document: taxed } = applyTax(discounted, { rate: 10, label: 'VAT' })
    const html = toHTML(withTotals(taxed))
    expect(html).toContain('10% Promo')
    expect(html).toContain('VAT')
  })

  it('removeDiscounts restores afterDiscounts to subtotal', () => {
    const { document: discounted } = applyDiscount(baseDoc, { type: 'percentage', value: 10 })
    const { document: clean, totals } = removeDiscounts(discounted)
    expect(clean.discounts).toBeUndefined()
    expect(totals.afterDiscounts).toBe(1000)
    expect(totals.amountDue).toBe(1000)
  })

  it('removeTax restores amountDue to original subtotal', () => {
    const { document: taxed } = applyTax(baseDoc, { rate: 20, label: 'GST' })
    const { totals } = removeTax(taxed)
    expect(totals.taxTotal).toBe(0)
    expect(totals.amountDue).toBe(1000)
  })
})

// ── Scenario 16: Validation Integration ──────────────────────────────────────

describe('scenario 16: validation integration', () => {
  it('reports errors for invalid currency, negative quantity, negative price, and due before issue', () => {
    const badDoc: InvoMLDocument = {
      $invoml: '1.0',
      meta: {
        documentType: 'invoice',
        number: 'BAD-001',
        issueDate: '2026-01-15',
        currency: 'INVALID',
        dueDate: '2026-01-01',
      },
      items: [
        { description: 'Bad qty', quantity: -1, unitPrice: 100 },
        { description: 'Bad price', quantity: 1, unitPrice: -50 },
      ],
    }
    const result = validate(badDoc)
    expect(result.valid).toBe(false)
    const codes = result.issues.map(i => i.code)
    expect(codes).toContain('INVALID_CURRENCY')
    expect(codes).toContain('NON_POSITIVE_QUANTITY')
    expect(codes).toContain('NEGATIVE_UNIT_PRICE')
    expect(codes).toContain('DUE_BEFORE_ISSUE')
  })

  it('returns valid after all issues are fixed', () => {
    const fixedDoc: InvoMLDocument = {
      $invoml: '1.0',
      meta: {
        documentType: 'invoice',
        number: 'FIXED-001',
        issueDate: '2026-01-15',
        currency: 'USD',
        dueDate: '2026-02-15',
      },
      items: [
        { description: 'Good item A', quantity: 1, unitPrice: 100 },
        { description: 'Good item B', quantity: 1, unitPrice: 50 },
      ],
    }
    const result = validate(fixedDoc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(i => i.level === 'error')).toHaveLength(0)
  })
})

// ── Scenario 17: Fragment + Editable Combo ────────────────────────────────────

describe('scenario 17: fragment + editable combo', () => {
  const doc = makeDoc()

  it('fragment mode omits DOCTYPE and html/head/body wrapper', () => {
    const html = toHTML(withTotals(doc), { fragment: true, editable: true })
    expect(html).not.toContain('<!DOCTYPE')
    expect(html).not.toMatch(/<html[\s>]/)
    expect(html).not.toMatch(/<head[\s>]/)
    expect(html).not.toMatch(/<body[\s>]/)
  })

  it('editable mode adds contenteditable to editable fields', () => {
    const html = toHTML(withTotals(doc), { fragment: true, editable: true })
    expect(html).toContain('contenteditable')
  })

  it('computed fields have contenteditable="false"', () => {
    const html = toHTML(withTotals(doc), { fragment: true, editable: true })
    expect(html).toContain('data-invoml-computed contenteditable="false"')
  })
})

// ── Scenario 18: Locale Fallback ──────────────────────────────────────────────

describe('scenario 18: locale fallback (invalid locale)', () => {
  const doc = makeDoc({
    meta: {
      documentType: 'invoice',
      number: 'LOC-001',
      issueDate: '2026-01-15',
      currency: 'USD',
      locale: 'xx-FAKE',
    },
  })

  it('calculate does not throw', () => {
    expect(() => calculate(doc)).not.toThrow()
    const totals = calculate(doc)
    expect(totals.total).toBe(100)
  })

  it('toHTML produces valid non-empty output', () => {
    expect(() => toHTML(withTotals(doc))).not.toThrow()
    const html = toHTML(withTotals(doc))
    expect(html.length).toBeGreaterThan(0)
    expect(html).toContain('INVOICE')
  })

  it('validate does not throw', () => {
    expect(() => validate(doc)).not.toThrow()
  })
})
