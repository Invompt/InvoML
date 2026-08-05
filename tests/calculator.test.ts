import { describe, it, expect } from 'vitest'
import { calculate } from '../src/calculator.js'
import type { InvoMLDocument } from '../src/types.js'

function makeDoc(overrides: Partial<InvoMLDocument> = {}): InvoMLDocument {
  return {
    $invoml: '1.0',
    meta: { documentType: 'invoice', number: 'TEST-001', issueDate: '2026-01-01', currency: 'USD' },
    from: { name: 'FICTIONAL SAMPLE COPPER QUILL CO' },
    to: { name: 'FICTIONAL SAMPLE INDIGO MARKET CO' },
    items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    ...overrides,
  }
}

describe('calculate', () => {
  it('minimal: 1 item, no tax', () => {
    const r = calculate(makeDoc())
    expect(r.subtotal).toBe(100)
    expect(r.taxTotal).toBe(0)
    expect(r.total).toBe(100)
    expect(r.amountDue).toBe(100)
  })

  it('basic VAT: 3 items, 20%', () => {
    const r = calculate(makeDoc({
      meta: { documentType: 'invoice', number: 'T', issueDate: '2026-01-01', currency: 'USD', tax: { label: 'VAT', rate: 20 } },
      items: [
        { description: 'A', quantity: 2, unitPrice: 50 },
        { description: 'B', quantity: 1, unitPrice: 75 },
        { description: 'C', quantity: 5, unitPrice: 30 },
      ],
    }))
    expect(r.subtotal).toBe(325)
    expect(r.taxTotal).toBe(65)
    expect(r.total).toBe(390)
  })

  it('inclusive tax: backs out GST', () => {
    const r = calculate(makeDoc({
      meta: { documentType: 'invoice', number: 'T', issueDate: '2026-01-01', currency: 'AUD', tax: { label: 'GST', rate: 10, inclusive: true } },
      items: [{ description: 'Storage crates', quantity: 10, unitPrice: 165 }],
    }))
    expect(r.subtotal).toBe(1650)
    expect(r.taxTotal).toBe(150)
    expect(r.total).toBe(1650)
  })

  it('compound tax: GST + PST parallel', () => {
    const r = calculate(makeDoc({
      meta: {
        documentType: 'invoice', number: 'T', issueDate: '2026-01-01', currency: 'CAD',
        tax: { system: 'compound', compound: true, categories: [
          { id: 'gst', label: 'GST', rate: 5 },
          { id: 'pst', label: 'PST', rate: 7 },
        ]},
      },
      items: [{ description: 'Storage crate', quantity: 1, unitPrice: 1000 }],
    }))
    expect(r.taxTotal).toBe(120)
    expect(r.total).toBe(1120)
  })

  it('credit note: negative totals', () => {
    const r = calculate(makeDoc({
      meta: { documentType: 'credit_note', number: 'CN', issueDate: '2026-01-01', currency: 'USD', creditNoteReference: 'INV-001', tax: { label: 'VAT', rate: 20 } },
      items: [{ description: 'Return', quantity: -1, unitPrice: 75 }],
    }))
    expect(r.subtotal).toBe(-75)
    expect(r.taxTotal).toBe(-15)
    expect(r.total).toBe(-90)
  })

  it('line discount: percentage', () => {
    const r = calculate(makeDoc({
      meta: { documentType: 'invoice', number: 'T', issueDate: '2026-01-01', currency: 'USD', tax: { label: 'VAT', rate: 20 } },
      items: [{ description: 'A', quantity: 2, unitPrice: 100, discount: '10%' }],
    }))
    expect(r.subtotal).toBe(180) // 200 - 10% = 180
    expect(r.taxTotal).toBe(36)  // 180 * 20%
    expect(r.total).toBe(216)
  })

  it('invoice-level discount: cascading', () => {
    const r = calculate(makeDoc({
      meta: { documentType: 'invoice', number: 'T', issueDate: '2026-01-01', currency: 'USD', tax: { label: 'VAT', rate: 20 } },
      items: [{ description: 'A', quantity: 1, unitPrice: 1000 }],
      discounts: [
        { type: 'percentage', value: 10 },
        { type: 'percentage', value: 5 },
      ],
    }))
    expect(r.afterDiscounts).toBe(855) // 1000 - 100 = 900, 900 - 45 = 855
    expect(r.taxTotal).toBe(171)  // 855 * 20%
    expect(r.total).toBe(1026)
  })

  it('reverse charge: display only, not in total', () => {
    const r = calculate(makeDoc({
      meta: {
        documentType: 'invoice', number: 'T', issueDate: '2026-01-01', currency: 'EUR',
        tax: { categories: [
          { id: 'S', label: 'VAT 21%', rate: 21, default: true },
          { id: 'AE', label: 'Reverse Charge', rate: 21, reverseCharge: true },
        ]},
      },
      items: [
        { description: 'Local', quantity: 1, unitPrice: 1000 },
        { description: 'Cross-border', quantity: 1, unitPrice: 2000, taxCategory: 'AE' },
      ],
    }))
    expect(r.taxTotal).toBe(210) // Only S category: 1000 * 21%
    expect(r.total).toBe(3210)   // 3000 + 210 (RC not added)
  })

  it('withholding: subtracted from total', () => {
    const r = calculate(makeDoc({
      meta: {
        documentType: 'invoice', number: 'T', issueDate: '2026-01-01', currency: 'PYG',
        tax: { categories: [
          { id: 'iva', label: 'IVA', rate: 10, default: true },
          { id: 'wht', label: 'WHT', rate: 3, withholding: true },
        ]},
      },
      items: [{ description: 'Storage crate', quantity: 1, unitPrice: 10000 }],
    }))
    expect(r.taxTotal).toBe(1000)        // IVA: 10000 * 10%
    expect(r.withholdingTotal).toBe(300)  // WHT: 10000 * 3%
    expect(r.total).toBe(10700)           // 10000 + 1000 - 300
  })

  it('prepaidAmount deducted from total to get amountDue', () => {
    const r = calculate(makeDoc({
      meta: { documentType: 'invoice', number: 'T', issueDate: '2026-01-01', currency: 'USD', tax: { label: 'VAT', rate: 20 } },
      items: [{ description: 'Storage crate', quantity: 1, unitPrice: 500 }],
      prepaidAmount: 200,
    }))
    expect(r.total).toBe(600)       // 500 + 100 (20% VAT)
    expect(r.prepaidAmount).toBe(200)
    expect(r.amountDue).toBe(400)   // 600 - 200
  })

  it('stale totals.prepaidAmount is ignored — only root-level prepaidAmount is used', () => {
    const r = calculate(makeDoc({
      meta: { documentType: 'invoice', number: 'T', issueDate: '2026-01-01', currency: 'USD', tax: { label: 'VAT', rate: 20 } },
      items: [{ description: 'Storage crate', quantity: 1, unitPrice: 500 }],
      prepaidAmount: 150,
      totals: { subtotal: 0, afterDiscounts: 0, taxTotal: 0, total: 0, amountDue: 0, prepaidAmount: 999, withholdingTotal: 0 },
    }))
    expect(r.total).toBe(600)       // 500 + 100 (20% VAT)
    expect(r.prepaidAmount).toBe(150) // root-level only — totals.prepaidAmount ignored
    expect(r.amountDue).toBe(450)   // 600 - 150
  })

  it('inclusive + withholding: withholding uses afterDiscounts × rate, total = afterDiscounts', () => {
    const r = calculate(makeDoc({
      meta: {
        documentType: 'invoice', number: 'T', issueDate: '2026-01-01', currency: 'USD',
        tax: {
          inclusive: true,
          categories: [
            { id: 'gst', label: 'GST', rate: 10, default: true },
            { id: 'wht', label: 'WHT', rate: 5, withholding: true },
          ],
        },
      },
      items: [{ description: 'Storage crate', quantity: 1, unitPrice: 1100 }],
    }))
    // GST inclusive: 1100 / 1.10 = 1000 net, taxTotal = 100
    expect(r.taxTotal).toBe(100)
    // WHT: applies to afterDiscounts (1100) * 5% = 55 — NOT the inclusive formula
    expect(r.withholdingTotal).toBe(55)
    // Per spec Step 5: inclusive total = afterDiscounts (WHT is informational, not deducted here)
    expect(r.total).toBe(1100)
    expect(r.amountDue).toBe(1100)
  })

  it('inclusive + exempt: exempt category has zero tax', () => {
    const r = calculate(makeDoc({
      meta: {
        documentType: 'invoice', number: 'T', issueDate: '2026-01-01', currency: 'USD',
        tax: {
          inclusive: true,
          categories: [
            { id: 'std', label: 'VAT 20%', rate: 20, default: true },
            { id: 'ex', label: 'Exempt', rate: 20, exempt: true },
          ],
        },
      },
      items: [
        { description: 'Taxable', quantity: 1, unitPrice: 1200, taxCategory: 'std' },
        { description: 'Exempt item', quantity: 1, unitPrice: 500, taxCategory: 'ex' },
      ],
    }))
    // std: 1200 / 1.20 = 1000 net, tax = 200
    // ex: exempt → tax = 0, base = 500
    expect(r.taxTotal).toBe(200)
    // inclusive total = afterDiscounts = 1700
    expect(r.total).toBe(1700)
  })
})
