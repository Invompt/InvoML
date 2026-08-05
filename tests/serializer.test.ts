import { describe, it, expect } from 'vitest'
import { toJSON, toMarkdown } from '../src/serializer.js'
import { calculate } from '../src/calculator.js'
import type { InvoMLDocument } from '../src/types.js'

// ─── Base fixture ─────────────────────────────────────────────────────────────

const baseDoc: InvoMLDocument = {
  $invoml: '1.0',
  meta: {
    documentType: 'invoice',
    number: 'INV-001',
    issueDate: '2026-01-15',
    currency: 'USD',
    dueDate: '2026-02-15',
    tax: { label: 'VAT', rate: 20 },
  },
  from: { name: 'FICTIONAL SAMPLE LANTERN QUILL CO', address: { lines: ['Sample business location'] }, email: 'billing@serializer.example.invalid' },
  to: { name: 'FICTIONAL SAMPLE HARBOR MARKET CO', address: { lines: ['Sample recipient location'] } },
  items: [
    { description: 'Storage bin cartons', quantity: 40, unitPrice: 150, unit: 'cartons' },
    { description: 'Shelf marker crates', quantity: 10, unitPrice: 120, unit: 'crates' },
  ],
  payment: {
    method: 'bank-international',
    beneficiary: 'FICTIONAL SAMPLE LANTERN QUILL CO',
    iban: 'EXAMPLE-IBAN-SERIALIZER',
    swift: 'EXAMPLE-SWIFT',
  },
  sections: { terms: { title: 'Terms', content: 'Net 30 days' } },
  notes: 'Thank you for your business!',
}

function withTotals(doc: InvoMLDocument): InvoMLDocument {
  return { ...doc, totals: calculate(doc) }
}

// ─── toJSON ───────────────────────────────────────────────────────────────────

describe('toJSON', () => {
  it('produces valid JSON string', () => {
    const json = toJSON(withTotals(baseDoc))
    expect(() => JSON.parse(json)).not.toThrow()
  })

  it('preserves $invoml version', () => {
    const parsed = JSON.parse(toJSON(withTotals(baseDoc)))
    expect(parsed.$invoml).toBe('1.0')
  })

  it('includes calculated totals', () => {
    const parsed = JSON.parse(toJSON(withTotals(baseDoc)))
    expect(parsed.totals.subtotal).toBe(7200)
    expect(parsed.totals.total).toBe(8640)
  })

  it('refreshes computed item fields when totals are present', () => {
    const parsed = JSON.parse(toJSON(withTotals(baseDoc)))
    expect(parsed.items[0].amount).toBe(6000)
    expect(parsed.items[0].taxAmount).toBe(1200)
    expect(parsed.items[1].amount).toBe(1200)
    expect(parsed.items[1].taxAmount).toBe(240)
  })

  it('ignores pre-filled computed item fields when totals are absent', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: {
        documentType: 'invoice',
        number: 'INV-STUB',
        issueDate: '2026-01-01',
        currency: 'USD',
        tax: { label: 'VAT', rate: 20 },
      },
      items: [{ description: 'Storage crate', quantity: 2, unitPrice: 50, amount: 999, taxAmount: 777 }],
    }

    const parsed = JSON.parse(toJSON(doc))
    expect(parsed.items[0].amount).toBe(100)
    expect(parsed.items[0].taxAmount).toBe(20)
    expect(parsed.totals).toBeUndefined()
  })

  it('pretty prints by default', () => {
    expect(toJSON(withTotals(baseDoc))).toContain('\n')
  })

  it('produces compact output when compact option is true', () => {
    expect(toJSON(withTotals(baseDoc), { compact: true })).not.toContain('\n')
  })

  it('keeps canonical dates in ISO form when presentation uses a localized preset', () => {
    const parsed = JSON.parse(toJSON({
      ...baseDoc,
      meta: {
        ...baseDoc.meta,
        issueDate: '2024-02-29',
        dueDate: '2024-03-31',
        locale: 'en-SG',
      },
      style: { dateFormat: 'long' },
    }))

    expect(parsed.meta.issueDate).toBe('2024-02-29')
    expect(parsed.meta.dueDate).toBe('2024-03-31')
    expect(parsed.style.dateFormat).toBe('long')
  })
})

// ─── toMarkdown — rendering order ─────────────────────────────────────────────

describe('toMarkdown — block ordering', () => {
  it('renders blocks in DEFAULT_ORDER when no style.order', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-X', issueDate: '2026-01-01', currency: 'USD' },
      from: { name: 'FICTIONAL SAMPLE COPPER QUILL CO' },
      to: { name: 'FICTIONAL SAMPLE INDIGO MARKET CO' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      payment: { beneficiary: 'FICTIONAL SAMPLE COPPER QUILL CO', bank: 'EXAMPLE BANK' },
      notes: 'A note',
    }
    const md = toMarkdown(withTotals(doc))
    const headerIdx = md.indexOf('# INVOICE INV-X')
    const fromIdx = md.indexOf('**From:**')
    const toIdx = md.indexOf('**To:**')
    const paymentIdx = md.indexOf('### Payment')
    const notesIdx = md.indexOf('A note')
    expect(headerIdx).toBeLessThan(fromIdx)
    expect(fromIdx).toBeLessThan(toIdx)
    expect(toIdx).toBeLessThan(paymentIdx)
    expect(paymentIdx).toBeLessThan(notesIdx)
  })

  it('renders blocks in explicit style.order', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-Y', issueDate: '2026-01-01', currency: 'USD' },
      from: { name: 'FICTIONAL SAMPLE AMBER QUILL CO' },
      to: { name: 'FICTIONAL SAMPLE BLUE MARKET CO' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      payment: { beneficiary: 'FICTIONAL SAMPLE AMBER QUILL CO' },
      notes: 'Note',
      // Reverse the normal from/to order
      style: { order: ['header', 'to', 'from', 'items', 'totals', 'payment', 'notes'] },
    }
    const md = toMarkdown(withTotals(doc))
    const toIdx = md.indexOf('**To:**')
    const fromIdx = md.indexOf('**From:**')
    // to comes before from in the output
    expect(toIdx).toBeLessThan(fromIdx)
  })

  it('ignores pre-filled computed item fields when totals are absent', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: {
        documentType: 'invoice',
        number: 'INV-UNT',
        issueDate: '2026-01-01',
        currency: 'USD',
        tax: { label: 'VAT', rate: 20 },
      },
      items: [{ description: 'Storage crate', quantity: 2, unitPrice: 50, amount: 999, taxAmount: 777 }],
    }

    const md = toMarkdown(doc)
    expect(md).toContain('| Storage crate | 2 | 50.00 | 20.00 | 100.00 |')
    expect(md).not.toContain('999.00')
    expect(md).not.toContain('777.00')
  })

  it('skips the payment block when doc.payment is absent', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'receipt', number: 'RCP-001', issueDate: '2026-01-01', currency: 'USD' },
      from: { name: 'FICTIONAL SAMPLE MOONBEAM CAFE' },
      items: [{ description: 'Coffee', quantity: 1, unitPrice: 5 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('### Payment')
  })

  it('skips the notes block when doc.notes is absent', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-Z', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('---\n')
  })

  it('skips a custom section block when its data is absent', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-Q', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      // No sections defined but explicit order references one
      style: { order: ['header', 'items', 'section:missing', 'totals'] },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('missing')
  })

  it('renders custom sections at the correct position in default order (after totals)', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-S', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      payment: { beneficiary: 'FICTIONAL SAMPLE AMBER QUILL CO' },
      sections: { appendix: { title: 'Appendix', content: 'Appendix content here.' } },
    }
    const md = toMarkdown(withTotals(doc))
    const totalsIdx = md.indexOf('**Subtotal**')
    const sectionIdx = md.indexOf('Appendix content here.')
    const paymentIdx = md.indexOf('### Payment')
    expect(totalsIdx).toBeLessThan(sectionIdx)
    expect(sectionIdx).toBeLessThan(paymentIdx)
  })

  it('renders multiple custom sections sorted alphabetically', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-M', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      sections: {
        zebra: { title: 'Zebra Section', content: 'Zebra content' },
        apple: { title: 'Apple Section', content: 'Apple content' },
      },
    }
    const md = toMarkdown(withTotals(doc))
    const appleIdx = md.indexOf('Apple content')
    const zebraIdx = md.indexOf('Zebra content')
    expect(appleIdx).toBeLessThan(zebraIdx)
  })
})

// ─── toMarkdown — document type patterns ──────────────────────────────────────

describe('toMarkdown — document type patterns', () => {
  it('receipt pattern: header, from, items, totals, notes — no to, no payment', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: {
        documentType: 'receipt',
        number: 'RCP-0047',
        issueDate: '2026-03-28',
        currency: 'JPY',
      },
      from: { name: 'FICTIONAL SAMPLE SAKURA CAFE KK' },
      items: [
        { description: 'Matcha Latte', quantity: 2, unitPrice: 580 },
        { description: 'Ceramic Mug', quantity: 1, unitPrice: 2200 },
      ],
      notes: 'Thank you for visiting.',
      style: { order: ['header', 'from', 'items', 'totals', 'notes'] },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('# RECEIPT RCP-0047')
    expect(md).toContain('**From:**')
    expect(md).toContain('Matcha Latte')
    expect(md).toContain('Thank you for visiting.')
    expect(md).not.toContain('**To:**')
    expect(md).not.toContain('### Payment')
  })

  it('credit note pattern: header shows CREDIT NOTE', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: {
        documentType: 'credit_note',
        number: 'CN-2026-0031',
        creditNoteReference: 'INV-2026-0142',
        issueDate: '2026-03-28',
        currency: 'GBP',
      },
      items: [
        { description: 'Refund — overpayment', quantity: -1, unitPrice: 2400 },
      ],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('# CREDIT NOTE CN-2026-0031')
  })

  it('quote pattern: expiryDate in header meta', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: {
        documentType: 'quote',
        number: 'QTE-001',
        issueDate: '2026-03-30',
        expiryDate: '2026-04-29',
        currency: 'USD',
      },
      items: [{ description: 'Display rack', quantity: 1, unitPrice: 5000 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('# QUOTE QTE-001')
    // expiryDate is NOT in the markdown header (toMarkdown only shows dueDate, not expiryDate)
    // Validate the date field that IS shown
    expect(md).toContain('2026-03-30')
  })
})

describe('toMarkdown — locale-aware date presentation', () => {
  it('formats issue, due, and expiry dates without changing the document', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: {
        documentType: 'quote',
        number: 'Q-SG',
        issueDate: '2024-02-29',
        dueDate: '2024-03-01',
        expiryDate: '2024-03-31',
        currency: 'SGD',
        locale: 'en-SG',
      },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      style: { dateFormat: 'long' },
    }

    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('**Date:** 29 February 2024')
    expect(md).toContain('**Due:** 1 March 2024')
    expect(md).toContain('**Expires:** 31 March 2024')
    expect(doc.meta.issueDate).toBe('2024-02-29')
    expect(doc.meta.dueDate).toBe('2024-03-01')
    expect(doc.meta.expiryDate).toBe('2024-03-31')
  })

  it('formats ja-JP dates with Japanese ordering', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: {
        documentType: 'invoice',
        number: 'INV-JP',
        issueDate: '2024-02-29',
        currency: 'JPY',
        locale: 'ja-JP',
      },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      style: { dateFormat: 'long' },
    }
    expect(toMarkdown(withTotals(doc))).toContain('**Date:** 2024年2月29日')
  })
})

// ─── toMarkdown — party rendering ─────────────────────────────────────────────

describe('toMarkdown — party rendering', () => {
  it('renders name, address, email, taxId when content is absent', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-P', issueDate: '2026-01-01', currency: 'USD' },
      from: {
        name: 'FICTIONAL SAMPLE LANTERN QUILL CO',
        address: { lines: ['Sample business location'] },
        email: 'billing@serializer.example.invalid',
        taxId: 'EXAMPLE-TAX-ID',
      },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('FICTIONAL SAMPLE LANTERN QUILL CO')
    expect(md).toContain('Sample business location')
    expect(md).toContain('billing@serializer.example.invalid')
    expect(md).toContain('Tax ID: EXAMPLE-TAX-ID')
  })

  it('preserves explicit structured address lines including blanks, Unicode, and RTL text', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-LINES', issueDate: '2026-01-01', currency: 'JPY' },
      to: {
        name: 'FICTIONAL SAMPLE POLYGLOT PAPER CO',
        address: { lines: ['サンプル所在地', '', 'موقع تجريبي', 'מיקום לדוגמה'] },
      },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('サンプル所在地\n\nموقع تجريبي\nמיקום לדוגמה')
  })

  it('renders phone when content is absent', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-P2', issueDate: '2026-01-01', currency: 'USD' },
      from: { name: 'FICTIONAL SAMPLE FIREFLY SHOP', phone: 'EXAMPLE-PHONE' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 50 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('EXAMPLE-PHONE')
  })

  it('renders website when content is absent', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-W', issueDate: '2026-01-01', currency: 'USD' },
      from: { name: 'FICTIONAL SAMPLE CLOCKWORK PAPER CO', website: 'https://business.example.invalid' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 50 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('https://business.example.invalid')
  })

  it('renders businessNumber when content is absent', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-BN', issueDate: '2026-01-01', currency: 'USD' },
      from: { name: 'FICTIONAL SAMPLE CLOCKWORK PAPER CO', businessNumber: 'EXAMPLE-BUSINESS-ID' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 50 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('Business No: EXAMPLE-BUSINESS-ID')
  })

  it('renders attention when content is absent', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-AT', issueDate: '2026-01-01', currency: 'USD' },
      to: { name: 'FICTIONAL SAMPLE HARBOR MARKET CO', attention: 'Example Accounts Team' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 50 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('Attn: Example Accounts Team')
  })

  it('uses free-form content verbatim', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-C', issueDate: '2026-01-01', currency: 'USD' },
      from: {
        content: 'Custom verbatim block\nLine two',
      },
      items: [{ description: 'Item', quantity: 1, unitPrice: 50 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('Custom verbatim block')
    expect(md).toContain('Line two')
  })
})

// ─── toMarkdown — number formatting ───────────────────────────────────────────

describe('toMarkdown — number formatting', () => {
  it('renders the line tax column from a recomputed working copy', () => {
    const md = toMarkdown(withTotals(baseDoc))
    expect(md).toContain('| Description | Quantity | Unit | Unit Price | Tax | Amount |')
    expect(md).toContain('| Storage bin cartons | 40 | cartons | 150.00 | 1,200.00 | 6,000.00 |')
  })

  it('formats with thousands separator: 7200 → "7,200.00"', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-F', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Storage crate', quantity: 40, unitPrice: 180 }], // 7200
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('7,200.00')
  })

  it('formats small numbers: 0.5 → "0.50"', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-S', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Half unit', quantity: 1, unitPrice: 0.5 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('0.50')
  })

  it('formats negative numbers: -75 → "-75.00"', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: {
        documentType: 'credit_note',
        number: 'CN-F',
        issueDate: '2026-01-01',
        currency: 'USD',
      },
      items: [{ description: 'Refund', quantity: -1, unitPrice: 75 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('-75.00')
  })

  it('formats JPY with no decimal places (dp=0)', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'receipt', number: 'R-JP', issueDate: '2026-01-01', currency: 'JPY' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 1500 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('1,500')
    // Should NOT have decimal part for JPY
    expect(md).not.toContain('1,500.00')
  })
})

// ─── toMarkdown — edge cases ──────────────────────────────────────────────────

describe('toMarkdown — edge cases', () => {
  it('document with no from party — skips from block gracefully', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-NF', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('**From:**')
    expect(md).toContain('INV-NF')
  })

  it('document with no to party — skips to block gracefully', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-NT', issueDate: '2026-01-01', currency: 'USD' },
      from: { name: 'FICTIONAL SAMPLE COPPER QUILL CO' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('**To:**')
  })

  it('document with no payment — skips payment block gracefully', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-NP', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('### Payment')
  })

  it('document with no notes — skips notes block gracefully', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-NN', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    }
    const md = toMarkdown(withTotals(doc))
    // Notes render as: ---\n\n*text*\n — without notes the separator is absent
    expect(md).not.toMatch(/^---$/m)
  })

  it('document with empty sections map — produces no section blocks', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-ES', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      sections: {},
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('###')
  })

  it('document with multiple custom sections renders all of them', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'quote', number: 'QTE-MS', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      sections: {
        scope: { title: 'Project Scope', content: 'Scope details here.' },
        timeline: { title: 'Estimated Timeline', content: 'Timeline details here.' },
      },
      style: { order: ['header', 'section:scope', 'section:timeline', 'items', 'totals'] },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('Project Scope')
    expect(md).toContain('Scope details here.')
    expect(md).toContain('Estimated Timeline')
    expect(md).toContain('Timeline details here.')
  })

  it('document with reference in meta renders reference line', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: {
        documentType: 'invoice',
        number: 'INV-REF',
        issueDate: '2026-01-01',
        currency: 'USD',
        reference: 'PO-9999',
      },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('**Reference:** PO-9999')
  })

  it('document with dueDate renders due date line', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: {
        documentType: 'invoice',
        number: 'INV-DD',
        issueDate: '2026-01-01',
        dueDate: '2026-01-31',
        currency: 'USD',
      },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('**Due:** 2026-01-31')
  })
})

// ─── toMarkdown — payment block ───────────────────────────────────────────────

describe('toMarkdown — payment block', () => {
  it('renders payment with structured fields', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      payment: {
        beneficiary: 'FICTIONAL SAMPLE LANTERN QUILL CO',
        bank: 'EXAMPLE BANK',
        iban: 'EXAMPLE-IBAN-STRUCTURED',
        swift: 'EXAMPLE-SWIFT',
        routingNumber: 'EXAMPLE-ROUTING',
        accountNumber: 'EXAMPLE-ACCOUNT',
      },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('**Beneficiary:** FICTIONAL SAMPLE LANTERN QUILL CO')
    expect(md).toContain('**Bank:** EXAMPLE BANK')
    expect(md).toContain('**IBAN:** EXAMPLE-IBAN-STRUCTURED')
    expect(md).toContain('**SWIFT/BIC:** EXAMPLE-SWIFT')
    expect(md).toContain('**Routing:** EXAMPLE-ROUTING')
    expect(md).toContain('**Account:** EXAMPLE-ACCOUNT')
  })

  it('renders payment with crypto fields', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-C', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      payment: {
        method: 'crypto',
        cryptoAddress: 'EXAMPLE-CRYPTO-ADDRESS',
        cryptoNetwork: 'EXAMPLE-NETWORK',
      },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('**Address:** EXAMPLE-CRYPTO-ADDRESS')
    expect(md).toContain('**Network:** EXAMPLE-NETWORK')
  })

  it('renders payment content verbatim when content is set', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-PC', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      payment: {
        content: 'Fictional payment details: EXAMPLE-ACCOUNT. Do not remit funds.',
        beneficiary: 'Should Not Appear',
      },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('Fictional payment details: EXAMPLE-ACCOUNT. Do not remit funds.')
    expect(md).not.toContain('Should Not Appear')
  })
})

// ─── toMarkdown — style.hidden ────────────────────────────────────────────────

describe('toMarkdown — style.hidden blocks', () => {
  it('hidden block "payment" — ### Payment not in output', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['payment'] },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('### Payment')
  })

  it('hidden block "notes" — notes content not in output', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['notes'] },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('Thank you for your business!')
  })

  it('hidden block "from" — **From:** not in output', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['from'] },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('**From:**')
  })

  it('hidden block "to" — **To:** not in output', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['to'] },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('**To:**')
  })

  it('hidden block does not suppress other blocks', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['payment'] },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).toContain('# INVOICE INV-001')
    expect(md).toContain('**From:**')
    expect(md).toContain('**To:**')
    expect(md).toContain('Storage bin cartons')
  })

  it('hidden section "section:terms" — section content not in output', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: {
        order: ['header', 'from', 'to', 'items', 'totals', 'section:terms', 'payment', 'notes'],
        hidden: ['section:terms'],
      },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('Net 30 days')
    expect(md).not.toContain('### Terms')
  })
})

describe('toMarkdown — style.hidden columns', () => {
  it('hidden column "tax" — no Tax column header in table', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['tax'] },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('| Description | Quantity | Unit | Unit Price | Tax | Amount |')
    expect(md).toContain('Description')
    expect(md).toContain('Amount')
  })

  it('hidden column "unit" — no Unit column header in table', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['unit'] },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('| Unit |')
    expect(md).not.toMatch(/\| Unit \|/)
  })

  it('hidden column "amount" — no Amount column header in table', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['amount'] },
    }
    const md = toMarkdown(withTotals(doc))
    // Amount column header should be absent
    const headerLine = md.split('\n').find(l => l.startsWith('|') && l.includes('Description'))
    expect(headerLine).toBeDefined()
    expect(headerLine).not.toContain('Amount')
  })

  it('hidden column "description" — no Description column in table', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['description'] },
    }
    const md = toMarkdown(withTotals(doc))
    const headerLine = md.split('\n').find(l => l.startsWith('|') && l.includes('Quantity'))
    expect(headerLine).toBeDefined()
    expect(headerLine).not.toContain('Description')
  })
})

describe('toMarkdown — style.hidden meta', () => {
  it('hidden meta "dueDate" — **Due:** line not in output', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['dueDate'] },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('**Due:**')
  })

  it('hidden meta "currency" — **Currency:** line not in output', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['currency'] },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('**Currency:**')
  })

  it('hidden meta "reference" — **Reference:** line not in output', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: {
        documentType: 'invoice',
        number: 'INV-REF2',
        issueDate: '2026-01-01',
        currency: 'USD',
        reference: 'PO-1234',
      },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
      style: { hidden: ['reference'] },
    }
    const md = toMarkdown(withTotals(doc))
    expect(md).not.toContain('**Reference:**')
  })

  it('hidden meta does not suppress other meta fields', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['dueDate'] },
    }
    const md = toMarkdown(withTotals(doc))
    // Date (issueDate) is always rendered
    expect(md).toContain('**Date:**')
    // currency is not hidden
    expect(md).toContain('**Currency:**')
  })
})

describe('toJSON — style.hidden', () => {
  it('toJSON preserves hidden field in output when present', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['tax', 'payment'] },
    }
    const parsed = JSON.parse(toJSON(withTotals(doc)))
    expect(parsed.style.hidden).toEqual(['tax', 'payment'])
  })

  it('toJSON does not affect item data regardless of hidden style', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['tax', 'amount', 'unit'] },
    }
    const parsed = JSON.parse(toJSON(withTotals(doc)))
    // Item data must remain intact
    expect(parsed.items[0].description).toBe('Storage bin cartons')
    expect(parsed.items[0].quantity).toBe(40)
    expect(parsed.items[0].unitPrice).toBe(150)
    expect(parsed.items[0].amount).toBe(6000)
    expect(parsed.items[0].taxAmount).toBe(1200)
  })

  it('toJSON does not omit payment data when payment block is hidden', () => {
    const doc: InvoMLDocument = {
      ...baseDoc,
      style: { hidden: ['payment'] },
    }
    const parsed = JSON.parse(toJSON(withTotals(doc)))
    // Data must stay in JSON output even if block is hidden in render
    expect(parsed.payment).toBeDefined()
    expect(parsed.payment.iban).toBe('EXAMPLE-IBAN-SERIALIZER')
  })
})
