import { describe, it, expect } from 'vitest'
import { calculate } from '../src/calculator.js'
import { toHTML } from '../src/html-renderer.js'
import { toMarkdown } from '../src/serializer.js'
import { validate } from '../src/validation.js'
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

// ─── Scenario 1: US Freelancer Invoice ────────────────────────────────────────

describe('Scenario 1 — US Freelancer Invoice (USD, no tax)', () => {
  const doc = makeDoc({
    meta: { documentType: 'invoice', number: 'US-001', issueDate: '2026-01-15', currency: 'USD' },
    from: { name: 'FICTIONAL SAMPLE PRAIRIE QUILL LLC', email: 'issuer@locale.example.invalid' },
    to: { name: 'FICTIONAL SAMPLE SUNSET MARKET LLC' },
    items: [
      { description: 'Storage bin cartons', quantity: 40, unitPrice: 150, unit: 'cartons' },
      { description: 'Shelf marker crates', quantity: 10, unitPrice: 120, unit: 'crates' },
      { description: 'Counter display kits', quantity: 5, unitPrice: 200, unit: 'kits' },
    ],
    payment: { method: 'bank-domestic', beneficiary: 'FICTIONAL SAMPLE PRAIRIE QUILL LLC', routingNumber: 'EXAMPLE-ROUTING', accountNumber: 'EXAMPLE-ACCOUNT' },
    notes: 'Net 30. Thank you for your business.',
  })

  it('calculate — subtotal, taxTotal, total, amountDue', () => {
    const totals = calculate(doc)
    expect(totals.subtotal).toBe(8200)   // 40*150 + 10*120 + 5*200
    expect(totals.taxTotal).toBe(0)
    expect(totals.total).toBe(8200)
    expect(totals.amountDue).toBe(8200)
  })

  it('toHTML — full document contains <!DOCTYPE html>', () => {
    const html = toHTML(withTotals(doc))
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('toHTML — fragment does not contain <!DOCTYPE', () => {
    const html = toHTML(withTotals(doc), { fragment: true })
    expect(html).not.toContain('<!DOCTYPE')
  })

  it('toMarkdown — non-empty and contains **Subtotal**', () => {
    const md = toMarkdown(withTotals(doc))
    expect(md.length).toBeGreaterThan(0)
    expect(md).toContain('**Subtotal**')
  })

  it('validate — valid with no errors', () => {
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(i => i.level === 'error')).toHaveLength(0)
  })
})

// ─── Scenario 2: German B2B Invoice ───────────────────────────────────────────

describe('Scenario 2 — German B2B Invoice (EUR, de-DE, 19% MwSt)', () => {
  const doc = makeDoc({
    meta: {
      documentType: 'invoice', number: 'DE-001', issueDate: '2026-01-15', currency: 'EUR',
      locale: 'de-DE', tax: { label: 'MwSt', rate: 19 },
    },
    from: { name: 'FICTIONAL SAMPLE BRONZE FINCH GMBH', taxId: 'EXAMPLE-GERMANY-TAX-ID' },
    to: { name: 'FICTIONAL SAMPLE CLOCKTOWER MARKET AG' },
    items: [
      { description: 'Regaletiketten', quantity: 80, unitPrice: 95, unit: 'Kartons' },
      { description: 'Lagerboxen', quantity: 20, unitPrice: 120, unit: 'Kisten' },
    ],
  })

  it('calculate — subtotal=10000, tax=1900, total=11900', () => {
    const totals = calculate(doc)
    expect(totals.subtotal).toBe(10000)    // 80*95 + 20*120
    expect(totals.taxTotal).toBe(1900)     // 10000 * 0.19
    expect(totals.total).toBe(11900)
    expect(totals.amountDue).toBe(11900)
  })

  it('toHTML — contains German-formatted numbers (dot thousands, comma decimal)', () => {
    const html = toHTML(withTotals(doc))
    // 10000 formatted as de-DE → "10.000,00"
    expect(html).toContain('10.000,00')
  })

  it('toHTML — fragment does not contain <!DOCTYPE', () => {
    const html = toHTML(withTotals(doc), { fragment: true })
    expect(html).not.toContain('<!DOCTYPE')
  })

  it('toMarkdown — non-empty and contains **Subtotal**', () => {
    const md = toMarkdown(withTotals(doc))
    expect(md.length).toBeGreaterThan(0)
    expect(md).toContain('**Subtotal**')
  })

  it('validate — valid with no errors', () => {
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(i => i.level === 'error')).toHaveLength(0)
  })
})

// ─── Scenario 3: Swiss Invoice ────────────────────────────────────────────────

describe('Scenario 3 — Swiss Invoice (CHF, de-CH, 7.7% tax)', () => {
  const doc = makeDoc({
    meta: {
      documentType: 'invoice', number: 'CH-001', issueDate: '2026-01-15', currency: 'CHF',
      locale: 'de-CH', tax: { label: 'MWST', rate: 7.7 },
    },
    from: { name: 'FICTIONAL SAMPLE GLACIER PAPER AG' },
    to: { name: 'FICTIONAL SAMPLE ALPINE KIOSK AG' },
    items: [
      { description: 'Archivboxen', quantity: 160, unitPrice: 85, unit: 'Kisten' },
    ],
  })

  it('calculate — subtotal=13600, tax=1047.20, total=14647.20', () => {
    const totals = calculate(doc)
    expect(totals.subtotal).toBe(13600)
    expect(totals.taxTotal).toBe(1047.20)
    expect(totals.total).toBe(14647.20)
    expect(totals.amountDue).toBe(14647.20)
  })

  it('toHTML — contains apostrophe thousands separator (Swiss format)', () => {
    const html = toHTML(withTotals(doc))
    // 13600 formatted as de-CH → "13'600.00"; apostrophe may be HTML-escaped as &#39;
    const hasRaw = html.includes("13'600")
    const hasEscaped = html.includes('13&#39;600')
    expect(hasRaw || hasEscaped).toBe(true)
  })

  it('toHTML — fragment does not contain <!DOCTYPE', () => {
    const html = toHTML(withTotals(doc), { fragment: true })
    expect(html).not.toContain('<!DOCTYPE')
  })

  it('toMarkdown — non-empty and contains **Subtotal**', () => {
    const md = toMarkdown(withTotals(doc))
    expect(md.length).toBeGreaterThan(0)
    expect(md).toContain('**Subtotal**')
  })

  it('validate — valid with no errors', () => {
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(i => i.level === 'error')).toHaveLength(0)
  })
})

// ─── Scenario 4: French Invoice ───────────────────────────────────────────────

describe('Scenario 4 — French Invoice (EUR, fr, 20% TVA)', () => {
  // Items: 50 boxes at 80 = 4000, 20 packs at 60 = 1200; subtotal=5200; tax=1040; total=6240
  const doc = makeDoc({
    meta: {
      documentType: 'invoice', number: 'FR-001', issueDate: '2026-01-15', currency: 'EUR',
      locale: 'fr', tax: { label: 'TVA', rate: 20 },
    },
    from: { name: 'FICTIONAL SAMPLE LILAC CRATE SAS' },
    to: { name: 'FICTIONAL SAMPLE RIVER PANTRY SARL' },
    items: [
      { description: 'Boîtes de rangement', quantity: 50, unitPrice: 80, unit: 'boîtes' },
      { description: 'Packs d’étiquettes', quantity: 20, unitPrice: 60, unit: 'packs' },
    ],
  })

  it('calculate — subtotal=5200, tax=1040, total=6240', () => {
    const totals = calculate(doc)
    expect(totals.subtotal).toBe(5200)
    expect(totals.taxTotal).toBe(1040)
    expect(totals.total).toBe(6240)
    expect(totals.amountDue).toBe(6240)
  })

  it('toHTML — contains thin-space or non-breaking space thousands separator', () => {
    const html = toHTML(withTotals(doc))
    // fr locale uses U+202F narrow no-break space as thousands separator
    // 5200 → "5\u202F200,00", 6240 → "6\u202F240,00"
    const hasThinSpace = html.includes('\u202F')
    const hasNbsp = html.includes('\u00A0')
    expect(hasThinSpace || hasNbsp).toBe(true)
  })

  it('toHTML — fragment does not contain <!DOCTYPE', () => {
    const html = toHTML(withTotals(doc), { fragment: true })
    expect(html).not.toContain('<!DOCTYPE')
  })

  it('toMarkdown — non-empty and contains **Subtotal**', () => {
    const md = toMarkdown(withTotals(doc))
    expect(md.length).toBeGreaterThan(0)
    expect(md).toContain('**Subtotal**')
  })

  it('validate — valid with no errors', () => {
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(i => i.level === 'error')).toHaveLength(0)
  })
})

// ─── Scenario 5: Indian Invoice ───────────────────────────────────────────────

describe('Scenario 5 — Indian Invoice (INR, en-IN, 18% GST, > 1 lakh)', () => {
  // Product quantities totaling > 100,000 to trigger Indian grouping
  // 1000 units at 100 = 100000, 500 cartons at 50 = 25000; subtotal=125000; tax=22500; total=147500
  const doc = makeDoc({
    meta: {
      documentType: 'invoice', number: 'IN-001', issueDate: '2026-01-15', currency: 'INR',
      locale: 'en-IN', tax: { label: 'GST', rate: 18 },
    },
    from: { name: 'FICTIONAL SAMPLE RAIN QUILL PVT LTD', taxId: 'EXAMPLE-INDIA-TAX-ID' },
    to: { name: 'FICTIONAL SAMPLE LOTUS MARKET LTD' },
    items: [
      { description: 'Shelf marker units', quantity: 1000, unitPrice: 100, unit: 'units' },
      { description: 'Packing label cartons', quantity: 500, unitPrice: 50, unit: 'cartons' },
    ],
  })

  it('calculate — subtotal=125000, tax=22500, total=147500', () => {
    const totals = calculate(doc)
    expect(totals.subtotal).toBe(125000)
    expect(totals.taxTotal).toBe(22500)
    expect(totals.total).toBe(147500)
    expect(totals.amountDue).toBe(147500)
  })

  it('toHTML — contains Indian grouping pattern (e.g. 1,25,000)', () => {
    const html = toHTML(withTotals(doc))
    // en-IN grouping: 125000 → "1,25,000.00"
    expect(html).toContain('1,25,000')
  })

  it('toHTML — fragment does not contain <!DOCTYPE', () => {
    const html = toHTML(withTotals(doc), { fragment: true })
    expect(html).not.toContain('<!DOCTYPE')
  })

  it('toMarkdown — non-empty and contains **Subtotal**', () => {
    const md = toMarkdown(withTotals(doc))
    expect(md.length).toBeGreaterThan(0)
    expect(md).toContain('**Subtotal**')
  })

  it('validate — valid with no errors', () => {
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(i => i.level === 'error')).toHaveLength(0)
  })
})

// ─── Scenario 6: Multi-Tax Australian Invoice ─────────────────────────────────

describe('Scenario 6 — Australian Multi-Tax Invoice (AUD, en-AU, GST + WET)', () => {
  // Items: 2 GST items + 1 WET item
  // GST 10%: item1=2000+item2=500 → base=2500, tax=250
  // WET 29%: item3=300 → base=300, tax=87
  // subtotal=2800, taxTotal=337, total=3137
  const doc = makeDoc({
    meta: {
      documentType: 'invoice', number: 'AU-001', issueDate: '2026-01-15', currency: 'AUD',
      locale: 'en-AU',
      tax: {
        categories: [
          { id: 'gst', label: 'GST', rate: 10, default: true },
          { id: 'wet', label: 'WET', rate: 29 },
        ],
      },
    },
    from: { name: 'FICTIONAL SAMPLE REEF PAPER PTY' },
    to: { name: 'FICTIONAL SAMPLE WATTLE MARKET PTY' },
    items: [
      { description: 'Counter display units', quantity: 10, unitPrice: 200 },
      { description: 'Storage divider boxes', quantity: 5, unitPrice: 100 },
      { description: 'Wine Products', quantity: 1, unitPrice: 300, taxCategory: 'wet' },
    ],
  })

  it('calculate — subtotal=2800, taxTotal=337, total=3137', () => {
    const totals = calculate(doc)
    expect(totals.subtotal).toBe(2800)
    expect(totals.taxTotal).toBe(337)
    expect(totals.total).toBe(3137)
    expect(totals.amountDue).toBe(3137)
  })

  it('calculate — taxDetails has 2 entries with correct amounts', () => {
    const totals = calculate(doc)
    expect(totals.taxDetails).toBeDefined()
    expect(totals.taxDetails!.length).toBe(2)

    const gst = totals.taxDetails!.find(d => d.category === 'gst')
    expect(gst).toBeDefined()
    expect(gst!.amount).toBe(250)  // 2500 * 0.10

    const wet = totals.taxDetails!.find(d => d.category === 'wet')
    expect(wet).toBeDefined()
    expect(wet!.amount).toBe(87)   // 300 * 0.29
  })

  it('toHTML — full document contains <!DOCTYPE html>', () => {
    const html = toHTML(withTotals(doc))
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('toHTML — fragment does not contain <!DOCTYPE', () => {
    const html = toHTML(withTotals(doc), { fragment: true })
    expect(html).not.toContain('<!DOCTYPE')
  })

  it('toMarkdown — non-empty and contains **Subtotal**', () => {
    const md = toMarkdown(withTotals(doc))
    expect(md.length).toBeGreaterThan(0)
    expect(md).toContain('**Subtotal**')
  })

  it('validate — valid with no errors', () => {
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(i => i.level === 'error')).toHaveLength(0)
  })
})

// ─── Scenario 7: UK VAT Inclusive ────────────────────────────────────────────

describe('Scenario 7 — UK VAT Inclusive (GBP, en-GB, 20% VAT inclusive)', () => {
  // 2 items: 10*60=600, 10*60=600 → subtotal=1200
  // Inclusive: total=1200, taxTotal=200 (back-out: 1200/1.2*0.2=200)
  const doc = makeDoc({
    meta: {
      documentType: 'invoice', number: 'GB-001', issueDate: '2026-01-15', currency: 'GBP',
      locale: 'en-GB', tax: { label: 'VAT', rate: 20, inclusive: true },
    },
    from: { name: 'FICTIONAL SAMPLE THISTLE CRATE LTD', taxId: 'EXAMPLE-UNITED-KINGDOM-TAX-ID' },
    to: { name: 'FICTIONAL SAMPLE CRESCENT KIOSK LTD' },
    items: [
      { description: 'Label roll pack A', quantity: 10, unitPrice: 60 },
      { description: 'Label roll pack B', quantity: 10, unitPrice: 60 },
    ],
  })

  it('calculate — total = subtotal = 1200, taxTotal = 200', () => {
    const totals = calculate(doc)
    expect(totals.subtotal).toBe(1200)
    expect(totals.total).toBe(1200)
    expect(totals.taxTotal).toBe(200)
    expect(totals.amountDue).toBe(1200)
  })

  it('calculate — afterDiscounts equals total for inclusive tax', () => {
    const totals = calculate(doc)
    expect(totals.afterDiscounts).toBe(totals.total)
  })

  it('toHTML — full document contains <!DOCTYPE html>', () => {
    const html = toHTML(withTotals(doc))
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('toHTML — fragment does not contain <!DOCTYPE', () => {
    const html = toHTML(withTotals(doc), { fragment: true })
    expect(html).not.toContain('<!DOCTYPE')
  })

  it('toMarkdown — non-empty and contains **Subtotal**', () => {
    const md = toMarkdown(withTotals(doc))
    expect(md.length).toBeGreaterThan(0)
    expect(md).toContain('**Subtotal**')
  })

  it('validate — valid with no errors', () => {
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(i => i.level === 'error')).toHaveLength(0)
  })
})

// ─── Scenario 8: Invoice with Discounts ──────────────────────────────────────

describe('Scenario 8 — Invoice with Discounts (USD, 10% tax, line + invoice discounts)', () => {
  // item1: 5*100=500, line 10% discount → amount=450
  // item2: 3*200=600 → amount=600
  // item3: 2*150=300 → amount=300
  // subtotal=1350, invoice-level fixed -50 (Loyalty) → afterDiscounts=1300
  // tax 10%: 130, total=1430
  const doc = makeDoc({
    meta: {
      documentType: 'invoice', number: 'DISC-001', issueDate: '2026-01-15', currency: 'USD',
      tax: { label: 'Tax', rate: 10 },
    },
    items: [
      { description: 'Display stand units', quantity: 5, unitPrice: 100, discount: { type: 'percentage', value: 10 } },
      { description: 'Shelf marker packs', quantity: 3, unitPrice: 200 },
      { description: 'Storage bin cartons', quantity: 2, unitPrice: 150 },
    ],
    discounts: [
      { type: 'fixed', value: 50, label: 'Loyalty' },
    ],
  })

  it('calculate — subtotal=1350, afterDiscounts=1300, taxTotal=130, total=1430', () => {
    const totals = calculate(doc)
    expect(totals.subtotal).toBe(1350)
    expect(totals.afterDiscounts).toBe(1300)
    expect(totals.taxTotal).toBe(130)
    expect(totals.total).toBe(1430)
    expect(totals.amountDue).toBe(1430)
  })

  it('calculate — discountDetails contains the Loyalty fixed discount', () => {
    const totals = calculate(doc)
    expect(totals.discountDetails).toBeDefined()
    const loyalty = totals.discountDetails!.find(d => d.label === 'Loyalty')
    expect(loyalty).toBeDefined()
    expect(loyalty!.amount).toBe(50)
  })

  it('calculate — afterDiscounts is less than subtotal', () => {
    const totals = calculate(doc)
    expect(totals.afterDiscounts).toBeLessThan(totals.subtotal)
  })

  it('toHTML — full document contains <!DOCTYPE html>', () => {
    const html = toHTML(withTotals(doc))
    expect(html).toContain('<!DOCTYPE html>')
  })

  it('toHTML — fragment does not contain <!DOCTYPE', () => {
    const html = toHTML(withTotals(doc), { fragment: true })
    expect(html).not.toContain('<!DOCTYPE')
  })

  it('toMarkdown — non-empty and contains **Subtotal**', () => {
    const md = toMarkdown(withTotals(doc))
    expect(md.length).toBeGreaterThan(0)
    expect(md).toContain('**Subtotal**')
  })

  it('validate — valid with no errors', () => {
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(i => i.level === 'error')).toHaveLength(0)
  })
})

// ─── Scenario 9: Zero-Decimal Currency (JPY) ─────────────────────────────────

describe('Scenario 9 — Zero-Decimal Currency (JPY, ja-JP, no tax)', () => {
  // Items: 2@15000=30000, 1@8000=8000, 3@3500=10500 → total=48500
  const doc = makeDoc({
    meta: {
      documentType: 'invoice', number: 'JP-001', issueDate: '2026-01-15', currency: 'JPY',
      locale: 'ja-JP',
    },
    from: { name: 'FICTIONAL SAMPLE HOSHI PAPER KK' },
    to: { name: 'FICTIONAL SAMPLE KITSUNE MARKET KK' },
    items: [
      { description: 'ウェブ開発', quantity: 2, unitPrice: 15000 },
      { description: 'デザイン', quantity: 1, unitPrice: 8000 },
      { description: 'テスト', quantity: 3, unitPrice: 3500 },
    ],
  })

  it('calculate — amountDue=48500 (no tax)', () => {
    const totals = calculate(doc)
    expect(totals.subtotal).toBe(48500)
    expect(totals.taxTotal).toBe(0)
    expect(totals.total).toBe(48500)
    expect(totals.amountDue).toBe(48500)
  })

  it('calculate — all totals are integers (no fractions)', () => {
    const totals = calculate(doc)
    expect(Number.isInteger(totals.subtotal)).toBe(true)
    expect(Number.isInteger(totals.total)).toBe(true)
    expect(Number.isInteger(totals.amountDue)).toBe(true)
  })

  it('toHTML — no decimal points in formatted numbers (zero-decimal currency)', () => {
    const html = toHTML(withTotals(doc))
    // JPY amounts should not have ".00" or any decimal point in the number formatting
    expect(html).not.toMatch(/48[,.]?500\./)
    expect(html).not.toContain('48500.00')
    expect(html).not.toContain('48,500.00')
  })

  it('toHTML — contains formatted JPY amount without decimals', () => {
    const html = toHTML(withTotals(doc))
    // 48500 formatted with dp=0 en-style → "48,500"
    expect(html).toContain('48,500')
  })

  it('toHTML — fragment does not contain <!DOCTYPE', () => {
    const html = toHTML(withTotals(doc), { fragment: true })
    expect(html).not.toContain('<!DOCTYPE')
  })

  it('toMarkdown — non-empty and contains **Subtotal**', () => {
    const md = toMarkdown(withTotals(doc))
    expect(md.length).toBeGreaterThan(0)
    expect(md).toContain('**Subtotal**')
  })

  it('validate — valid with no errors', () => {
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(i => i.level === 'error')).toHaveLength(0)
  })
})
