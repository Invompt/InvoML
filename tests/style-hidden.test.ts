import { describe, it, expect } from 'vitest'
import { resolveHidden, resolveStyle, validateStyle, COLUMN_NAMES, META_FIELD_NAMES } from '../src/style.js'
import { detectItemColumns } from '../src/render-shared.js'
import { toHTML } from '../src/html-renderer.js'
import { toMarkdown, toJSON } from '../src/serializer.js'
import { calculate } from '../src/calculator.js'
import type { InvoMLDocument } from '../src/types.js'

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeDoc(overrides: Partial<InvoMLDocument> = {}): InvoMLDocument {
  return {
    $invoml: '1.0',
    meta: {
      documentType: 'invoice',
      number: 'INV-001',
      issueDate: '2026-01-15',
      dueDate: '2026-02-15',
      currency: 'USD',
      reference: 'REF-42',
      tax: { label: 'VAT', rate: 20 },
    },
    from: { name: 'FICTIONAL SAMPLE LANTERN QUILL CO', address: { lines: ['Sample business location'] } },
    to: { name: 'FICTIONAL SAMPLE HARBOR MARKET CO', address: { lines: ['Sample recipient location'] } },
    items: [
      { description: 'Label roll packs', quantity: 10, unitPrice: 100, unit: 'packs' },
      { description: 'Storage divider boxes', quantity: 5, unitPrice: 80, unit: 'boxes' },
    ],
    payment: { beneficiary: 'FICTIONAL SAMPLE LANTERN QUILL CO', iban: 'EXAMPLE-IBAN-HIDDEN' },
    notes: 'Thank you!',
    sections: { terms: { title: 'Terms', content: 'Net 30.' } },
    ...overrides,
  }
}

function withTotals(doc: InvoMLDocument): InvoMLDocument {
  return { ...doc, totals: calculate(doc) }
}

// ─── COLUMN_NAMES / META_FIELD_NAMES ─────────────────────────────────────────

describe('COLUMN_NAMES', () => {
  it('contains all 7 item column names', () => {
    expect(COLUMN_NAMES).toContain('tax')
    expect(COLUMN_NAMES).toContain('unit')
    expect(COLUMN_NAMES).toContain('discount')
    expect(COLUMN_NAMES).toContain('quantity')
    expect(COLUMN_NAMES).toContain('unitPrice')
    expect(COLUMN_NAMES).toContain('description')
    expect(COLUMN_NAMES).toContain('amount')
    expect(COLUMN_NAMES).toHaveLength(7)
  })
})

describe('META_FIELD_NAMES', () => {
  it('contains all 5 header meta field names', () => {
    expect(META_FIELD_NAMES).toContain('dueDate')
    expect(META_FIELD_NAMES).toContain('expiryDate')
    expect(META_FIELD_NAMES).toContain('currency')
    expect(META_FIELD_NAMES).toContain('reference')
    expect(META_FIELD_NAMES).toContain('creditNoteReference')
    expect(META_FIELD_NAMES).toHaveLength(5)
  })
})

// ─── resolveHidden ────────────────────────────────────────────────────────────

describe('resolveHidden — undefined / empty', () => {
  it('returns empty sets for undefined input', () => {
    const r = resolveHidden(undefined)
    expect(r.columns.size).toBe(0)
    expect(r.blocks.size).toBe(0)
    expect(r.meta.size).toBe(0)
  })

  it('returns empty sets for empty array', () => {
    const r = resolveHidden([])
    expect(r.columns.size).toBe(0)
    expect(r.blocks.size).toBe(0)
    expect(r.meta.size).toBe(0)
  })
})

describe('resolveHidden — prefixed entries', () => {
  it('column: prefix → columns set', () => {
    const r = resolveHidden(['column:tax'])
    expect(r.columns.has('tax')).toBe(true)
    expect(r.blocks.size).toBe(0)
    expect(r.meta.size).toBe(0)
  })

  it('block: prefix → blocks set', () => {
    const r = resolveHidden(['block:payment'])
    expect(r.blocks.has('payment')).toBe(true)
    expect(r.columns.size).toBe(0)
    expect(r.meta.size).toBe(0)
  })

  it('meta: prefix → meta set', () => {
    const r = resolveHidden(['meta:dueDate'])
    expect(r.meta.has('dueDate')).toBe(true)
    expect(r.columns.size).toBe(0)
    expect(r.blocks.size).toBe(0)
  })

  it('section: prefix → blocks set (full name preserved)', () => {
    const r = resolveHidden(['section:terms'])
    expect(r.blocks.has('section:terms')).toBe(true)
    expect(r.columns.size).toBe(0)
    expect(r.meta.size).toBe(0)
  })

  it('handles multiple prefixed entries of different categories', () => {
    const r = resolveHidden(['column:discount', 'block:notes', 'meta:currency'])
    expect(r.columns.has('discount')).toBe(true)
    expect(r.blocks.has('notes')).toBe(true)
    expect(r.meta.has('currency')).toBe(true)
  })

  it('strips prefix from column name correctly', () => {
    const r = resolveHidden(['column:unitPrice'])
    expect(r.columns.has('unitPrice')).toBe(true)
    // should NOT store the prefixed form
    expect(r.columns.has('column:unitPrice')).toBe(false)
  })
})

describe('resolveHidden — bare name resolution', () => {
  it('bare column name → columns set', () => {
    const r = resolveHidden(['tax'])
    expect(r.columns.has('tax')).toBe(true)
    expect(r.blocks.size).toBe(0)
    expect(r.meta.size).toBe(0)
  })

  it('bare block name → blocks set', () => {
    const r = resolveHidden(['payment'])
    expect(r.blocks.has('payment')).toBe(true)
    expect(r.columns.size).toBe(0)
    expect(r.meta.size).toBe(0)
  })

  it('bare meta name → meta set', () => {
    const r = resolveHidden(['dueDate'])
    expect(r.meta.has('dueDate')).toBe(true)
    expect(r.columns.size).toBe(0)
    expect(r.blocks.size).toBe(0)
  })

  it('resolves all bare column names', () => {
    for (const col of COLUMN_NAMES) {
      const r = resolveHidden([col])
      expect(r.columns.has(col)).toBe(true)
    }
  })

  it('resolves all bare meta field names', () => {
    for (const f of META_FIELD_NAMES) {
      const r = resolveHidden([f])
      expect(r.meta.has(f)).toBe(true)
    }
  })

  it('resolves all bare block names', () => {
    const blockNames = ['header', 'from', 'to', 'items', 'totals', 'payment', 'notes']
    for (const b of blockNames) {
      const r = resolveHidden([b])
      expect(r.blocks.has(b)).toBe(true)
    }
  })

  it('columns take priority over blocks for bare "description"', () => {
    // description is a column name — should resolve to columns, not blocks
    const r = resolveHidden(['description'])
    expect(r.columns.has('description')).toBe(true)
    expect(r.blocks.size).toBe(0)
  })

  it('unknown bare names are silently dropped', () => {
    const r = resolveHidden(['nonexistent', 'fooBar'])
    expect(r.columns.size).toBe(0)
    expect(r.blocks.size).toBe(0)
    expect(r.meta.size).toBe(0)
  })
})

describe('resolveHidden — mixed and edge cases', () => {
  it('handles a realistic mixed hidden array', () => {
    const r = resolveHidden(['tax', 'payment', 'dueDate', 'column:unit', 'section:terms'])
    expect(r.columns.has('tax')).toBe(true)
    expect(r.columns.has('unit')).toBe(true)
    expect(r.blocks.has('payment')).toBe(true)
    expect(r.blocks.has('section:terms')).toBe(true)
    expect(r.meta.has('dueDate')).toBe(true)
  })

  it('deduplicates — same entry twice produces one set entry', () => {
    const r = resolveHidden(['tax', 'tax', 'column:tax'])
    expect(r.columns.size).toBe(1)
    expect(r.columns.has('tax')).toBe(true)
  })

  it('handles unknown entries mixed with valid entries', () => {
    const r = resolveHidden(['tax', 'unknown_field', 'payment'])
    expect(r.columns.has('tax')).toBe(true)
    expect(r.blocks.has('payment')).toBe(true)
    // unknown_field silently dropped
    expect(r.columns.size).toBe(1)
    expect(r.blocks.size).toBe(1)
    expect(r.meta.size).toBe(0)
  })
})

// ─── resolveStyle — hidden field ─────────────────────────────────────────────

describe('resolveStyle — hidden', () => {
  it('returns empty hidden sets when no style', () => {
    const doc = makeDoc({ style: undefined })
    const s = resolveStyle(doc)
    expect(s.hidden.columns.size).toBe(0)
    expect(s.hidden.blocks.size).toBe(0)
    expect(s.hidden.meta.size).toBe(0)
  })

  it('returns empty hidden sets when style has no hidden', () => {
    const doc = makeDoc({ style: { template: 'minimal' } })
    const s = resolveStyle(doc)
    expect(s.hidden.columns.size).toBe(0)
  })

  it('returns resolved hidden when style.hidden is set', () => {
    const doc = makeDoc({ style: { hidden: ['tax', 'payment'] } })
    const s = resolveStyle(doc)
    expect(s.hidden.columns.has('tax')).toBe(true)
    expect(s.hidden.blocks.has('payment')).toBe(true)
  })
})

// ─── validateStyle — hidden warnings ─────────────────────────────────────────

describe('validateStyle — hidden entries', () => {
  it('accepts empty hidden array without warnings', () => {
    const r = validateStyle({ hidden: [] })
    expect(r.valid).toBe(true)
    expect(r.warnings).toHaveLength(0)
  })

  it('accepts all valid bare column names without warnings', () => {
    const r = validateStyle({ hidden: [...COLUMN_NAMES] as string[] })
    expect(r.warnings).toHaveLength(0)
  })

  it('accepts all valid bare meta names without warnings', () => {
    const r = validateStyle({ hidden: [...META_FIELD_NAMES] as string[] })
    expect(r.warnings).toHaveLength(0)
  })

  it('accepts all valid bare block names without warnings', () => {
    const r = validateStyle({ hidden: ['header', 'from', 'to', 'items', 'totals', 'payment', 'notes'] })
    expect(r.warnings).toHaveLength(0)
  })

  it('accepts prefixed column: entries without warnings', () => {
    const r = validateStyle({ hidden: ['column:tax', 'column:unit'] })
    expect(r.warnings).toHaveLength(0)
  })

  it('accepts prefixed block: entries without warnings', () => {
    const r = validateStyle({ hidden: ['block:payment', 'block:notes'] })
    expect(r.warnings).toHaveLength(0)
  })

  it('accepts prefixed meta: entries without warnings', () => {
    const r = validateStyle({ hidden: ['meta:dueDate', 'meta:currency'] })
    expect(r.warnings).toHaveLength(0)
  })

  it('accepts section: entries without warnings', () => {
    const r = validateStyle({ hidden: ['section:terms', 'section:warranty'] })
    expect(r.warnings).toHaveLength(0)
  })

  it('warns on unrecognised bare entry', () => {
    const r = validateStyle({ hidden: ['unknownField'] })
    expect(r.warnings.length).toBeGreaterThan(0)
    expect(r.warnings.some(w => w.includes('unknownField'))).toBe(true)
  })

  it('warns on each unrecognised entry — one warning per unknown entry', () => {
    const r = validateStyle({ hidden: ['bad1', 'bad2', 'bad3'] })
    expect(r.warnings).toHaveLength(3)
  })

  it('unrecognised entries produce warnings but NOT errors — valid stays true', () => {
    const r = validateStyle({ hidden: ['unknownField'] })
    expect(r.valid).toBe(true)
    expect(r.errors).toHaveLength(0)
  })
})

// ─── detectItemColumns — hidden set ─────────────────────────────────────────

describe('detectItemColumns — hidden parameter', () => {
  const items = [
    { description: 'Item A', quantity: 1, unitPrice: 100, unit: 'boxes', taxAmount: 20 },
  ]

  it('without hidden: detects all columns present in data', () => {
    const r = detectItemColumns(items)
    expect(r.hasUnit).toBe(true)
    expect(r.hasTax).toBe(true)
  })

  it('hidden unit column: hasUnit becomes false even when data present', () => {
    const r = detectItemColumns(items, new Set(['unit']))
    expect(r.hasUnit).toBe(false)
  })

  it('hidden tax column: hasTax becomes false even when data present', () => {
    const r = detectItemColumns(items, new Set(['tax']))
    expect(r.hasTax).toBe(false)
  })

  it('hidden discount column: hasDiscount becomes false even when data present', () => {
    const itemsWithDiscount = [{ description: 'X', quantity: 1, unitPrice: 50, discount: { type: 'percentage' as const, value: 10 } }]
    const r = detectItemColumns(itemsWithDiscount, new Set(['discount']))
    expect(r.hasDiscount).toBe(false)
  })

  it('non-hidden columns still detected normally', () => {
    const r = detectItemColumns(items, new Set(['unit']))
    // tax is not hidden and data is present
    expect(r.hasTax).toBe(true)
  })

  it('empty hidden set: same as no hidden', () => {
    const r = detectItemColumns(items, new Set())
    expect(r.hasUnit).toBe(true)
    expect(r.hasTax).toBe(true)
  })

  it('column not in data and not in hidden set: still false', () => {
    const itemsNoUnit = [{ description: 'Item', quantity: 1, unitPrice: 100 }]
    const r = detectItemColumns(itemsNoUnit, new Set())
    expect(r.hasUnit).toBe(false)
  })
})

// ─── HTML renderer — hidden blocks ──────────────────────────────────────────

describe('toHTML — hidden blocks', () => {
  it('hidden payment block: payment section not in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['payment'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="payment"')
  })

  it('visible payment block: payment section present in output', () => {
    const doc = withTotals(makeDoc())
    const html = toHTML(doc)
    expect(html).toContain('data-invoml-block="payment"')
  })

  it('hidden notes block: notes section not in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['notes'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="notes"')
  })

  it('hidden totals block: totals section not in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['totals'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="totals"')
  })

  it('hidden custom section: section not in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['section:terms'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-section="terms"')
  })

  it('hiding one block does not remove other blocks', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['payment'] } }))
    const html = toHTML(doc)
    expect(html).toContain('data-invoml-block="items"')
    expect(html).toContain('data-invoml-block="totals"')
    expect(html).toContain('data-invoml-block="notes"')
  })

  it('block: prefix hides block', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['block:payment'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="payment"')
  })

  it('hidden from block: from party not in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['from'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="from"')
  })

  it('hiding both from and to: parties wrapper div not rendered', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['from', 'to'] } }))
    const html = toHTML(doc)
    // CSS always contains .invoml-parties rule; check for the rendered div element instead
    expect(html).not.toContain('class="invoml-parties"')
  })
})

// ─── HTML renderer — hidden columns ─────────────────────────────────────────

describe('toHTML — hidden columns', () => {
  it('hidden tax column: no tax header or tax cells', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['tax'] } }))
    const html = toHTML(doc)
    // Tax th should not appear
    expect(html).not.toMatch(/<th[^>]*>Tax<\/th>/)
    // taxAmount cell should not appear
    expect(html).not.toContain('items.0.taxAmount')
  })

  it('visible tax column: tax header present when data exists', () => {
    const doc = withTotals(makeDoc())
    const html = toHTML(doc)
    expect(html).toContain('Tax')
    expect(html).toContain('items.0.taxAmount')
  })

  it('hidden unit column: no unit header or unit cells', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['unit'] } }))
    const html = toHTML(doc)
    expect(html).not.toMatch(/<th[^>]*>Unit<\/th>/)
    // Use a precise pattern — items.0.unit" (with closing quote) to avoid matching items.0.unitPrice
    expect(html).not.toContain('items.0.unit"')
  })

  it('hidden discount column: no discount header', () => {
    const doc = withTotals(makeDoc({
      items: [{ description: 'X', quantity: 1, unitPrice: 100, discount: { type: 'percentage', value: 10 } }],
      style: { hidden: ['discount'] },
    }))
    const html = toHTML(doc)
    expect(html).not.toMatch(/<th[^>]*>Discount<\/th>/)
  })

  it('hidden quantity column: no Quantity header', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['quantity'] } }))
    const html = toHTML(doc)
    expect(html).not.toMatch(/<th[^>]*>Quantity<\/th>/)
    expect(html).not.toContain('items.0.quantity')
  })

  it('hidden unitPrice column: no Unit Price header', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['unitPrice'] } }))
    const html = toHTML(doc)
    expect(html).not.toMatch(/<th[^>]*>Unit Price<\/th>/)
    expect(html).not.toContain('items.0.unitPrice')
  })

  it('hidden description column: no Description header', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['description'] } }))
    const html = toHTML(doc)
    expect(html).not.toMatch(/<th[^>]*>Description<\/th>/)
    expect(html).not.toContain('items.0.description')
  })

  it('hidden amount column: no Amount header', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['amount'] } }))
    const html = toHTML(doc)
    expect(html).not.toMatch(/<th[^>]*>Amount<\/th>/)
    expect(html).not.toContain('items.0.amount')
  })

  it('hiding one column does not remove others', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['tax'] } }))
    const html = toHTML(doc)
    expect(html).toContain('items.0.description')
    expect(html).toContain('items.0.unitPrice')
    expect(html).toContain('items.0.amount')
  })

  it('column: prefix hides column', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['column:tax'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('items.0.taxAmount')
  })
})

// ─── HTML renderer — hidden meta fields ─────────────────────────────────────

describe('toHTML — hidden meta fields', () => {
  it('hidden dueDate: no Due meta item', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['dueDate'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('meta.dueDate')
  })

  it('visible dueDate: Due meta item present', () => {
    const doc = withTotals(makeDoc())
    const html = toHTML(doc)
    expect(html).toContain('meta.dueDate')
  })

  it('hidden currency: no Currency meta item', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['currency'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('meta.currency')
  })

  it('hidden reference: no Reference meta item', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['reference'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('meta.reference')
  })

  it('hidden meta: prefix hides meta field', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['meta:dueDate'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('meta.dueDate')
  })

  it('hiding one meta field does not remove others', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['dueDate'] } }))
    const html = toHTML(doc)
    // issueDate is never hideable (always rendered)
    expect(html).toContain('meta.issueDate')
  })

  it('hidden creditNoteReference: no Ref meta item', () => {
    const doc = withTotals(makeDoc({
      meta: {
        documentType: 'credit_note',
        number: 'CN-001',
        issueDate: '2026-01-01',
        currency: 'USD',
        creditNoteReference: 'INV-001',
      },
      style: { hidden: ['creditNoteReference'] },
    }))
    const html = toHTML(doc)
    expect(html).not.toContain('meta.creditNoteReference')
  })
})

// ─── Serializer — hidden blocks ──────────────────────────────────────────────

describe('toMarkdown — hidden blocks', () => {
  it('hidden payment block: no payment heading in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['payment'] } }))
    const md = toMarkdown(doc)
    expect(md).not.toContain('### Payment')
    expect(md).not.toContain('IBAN')
  })

  it('visible payment block: payment section in output', () => {
    const doc = withTotals(makeDoc())
    const md = toMarkdown(doc)
    expect(md).toContain('IBAN')
  })

  it('hidden notes block: notes not in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['notes'] } }))
    const md = toMarkdown(doc)
    expect(md).not.toContain('Thank you!')
  })

  it('hidden totals block: totals table not in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['totals'] } }))
    const md = toMarkdown(doc)
    expect(md).not.toContain('Subtotal')
  })

  it('hidden custom section: section content not in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['section:terms'] } }))
    const md = toMarkdown(doc)
    expect(md).not.toContain('### Terms')
    expect(md).not.toContain('Net 30.')
  })

  it('hidden from block: From party not in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['from'] } }))
    const md = toMarkdown(doc)
    expect(md).not.toContain('**From:**')
  })
})

// ─── Serializer — hidden columns ────────────────────────────────────────────

describe('toMarkdown — hidden columns', () => {
  it('hidden tax column: no Tax column header', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['tax'] } }))
    const md = toMarkdown(doc)
    expect(md).not.toContain('Tax')
  })

  it('hidden unit column: no Unit column header', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['unit'] } }))
    const md = toMarkdown(doc)
    expect(md).not.toContain('| Unit |')
    expect(md).not.toContain('Unit |')
  })

  it('hidden quantity column: no Quantity column header', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['quantity'] } }))
    const md = toMarkdown(doc)
    expect(md).not.toContain('Quantity')
  })

  it('hidden unitPrice column: no Unit Price column header', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['unitPrice'] } }))
    const md = toMarkdown(doc)
    expect(md).not.toContain('Unit Price')
  })

  it('hidden amount column: no Amount column header', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['amount'] } }))
    const md = toMarkdown(doc)
    expect(md).not.toContain('Amount')
  })

  it('hidden description column: no Description column header', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['description'] } }))
    const md = toMarkdown(doc)
    expect(md).not.toContain('Description')
  })

  it('hiding one column does not remove others', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['tax'] } }))
    const md = toMarkdown(doc)
    expect(md).toContain('Description')
    expect(md).toContain('Amount')
  })
})

// ─── Serializer — hidden meta fields ────────────────────────────────────────

describe('toMarkdown — hidden meta fields', () => {
  it('hidden dueDate: no Due field in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['dueDate'] } }))
    const md = toMarkdown(doc)
    expect(md).not.toContain('**Due:**')
  })

  it('visible dueDate: Due field present in output', () => {
    const doc = withTotals(makeDoc())
    const md = toMarkdown(doc)
    expect(md).toContain('**Due:**')
  })

  it('hidden currency: no Currency field in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['currency'] } }))
    const md = toMarkdown(doc)
    expect(md).not.toContain('**Currency:**')
  })

  it('hidden reference: no Reference field in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['reference'] } }))
    const md = toMarkdown(doc)
    expect(md).not.toContain('**Reference:**')
  })

  it('hiding one meta field does not remove others', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['dueDate'] } }))
    const md = toMarkdown(doc)
    expect(md).toContain('**Date:**')
  })
})

// ─── Integration — hidden is purely presentational ───────────────────────────

describe('style.hidden — presentational only', () => {
  it('totals are identical with or without hidden columns', () => {
    const base = withTotals(makeDoc())
    const withHidden = withTotals(makeDoc({ style: { hidden: ['tax', 'unit', 'discount'] } }))
    // Totals must not change
    expect(withHidden.totals!.total).toBe(base.totals!.total)
    expect(withHidden.totals!.subtotal).toBe(base.totals!.subtotal)
  })

  it('hidden blocks do not remove data from JSON output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['payment', 'notes'] } }))
    const parsed = JSON.parse(toJSON(doc))
    // Data preserved in JSON even when block is hidden from text render
    expect(parsed.payment).toBeDefined()
    expect(parsed.notes).toBe('Thank you!')
  })

  it('full document with multiple hidden elements renders without throwing', () => {
    const doc = withTotals(makeDoc({
      style: { hidden: ['tax', 'unit', 'payment', 'dueDate', 'section:terms'] },
    }))
    expect(() => toHTML(doc)).not.toThrow()
    expect(() => toMarkdown(doc)).not.toThrow()
  })

  it('all columns hidden: items block still renders (empty table body)', () => {
    const allColumns = [...COLUMN_NAMES] as string[]
    const doc = withTotals(makeDoc({ style: { hidden: allColumns } }))
    const html = toHTML(doc)
    // items block should still be present even with all columns hidden
    expect(html).toContain('invoml-items')
  })
})

// ─── Edge cases — whitespace, empty, garbage prefixes ────────────────────────

describe('resolveHidden — whitespace and empty entries', () => {
  it('trims surrounding whitespace before resolving', () => {
    const r = resolveHidden(['  tax  ', ' payment', 'dueDate '])
    expect(r.columns.has('tax')).toBe(true)
    expect(r.blocks.has('payment')).toBe(true)
    expect(r.meta.has('dueDate')).toBe(true)
  })

  it('drops empty string entries silently', () => {
    const r = resolveHidden(['', 'tax', ''])
    expect(r.columns.size).toBe(1)
    expect(r.columns.has('tax')).toBe(true)
  })

  it('drops whitespace-only entries silently', () => {
    const r = resolveHidden(['   ', '\t', 'payment'])
    expect(r.blocks.size).toBe(1)
    expect(r.blocks.has('payment')).toBe(true)
  })

  it('drops prefixed entries with empty tail', () => {
    const r = resolveHidden(['column:', 'block:', 'meta:', 'section:'])
    expect(r.columns.size).toBe(0)
    expect(r.blocks.size).toBe(0)
    expect(r.meta.size).toBe(0)
  })

  it('drops prefixed entries with unknown tail (column:notReal)', () => {
    const r = resolveHidden(['column:notReal', 'block:bogus', 'meta:nonsense'])
    expect(r.columns.size).toBe(0)
    expect(r.blocks.size).toBe(0)
    expect(r.meta.size).toBe(0)
  })

  it('case-sensitive resolution: "Tax" does not match "tax"', () => {
    const r = resolveHidden(['Tax', 'TAX', 'PAYMENT'])
    expect(r.columns.size).toBe(0)
    expect(r.blocks.size).toBe(0)
  })
})

describe('validateStyle — prefixed garbage warnings (C2)', () => {
  it('warns on column: with empty tail', () => {
    const r = validateStyle({ hidden: ['column:'] })
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('column:')
  })

  it('warns on block: with empty tail', () => {
    const r = validateStyle({ hidden: ['block:'] })
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('block:')
  })

  it('warns on meta: with empty tail', () => {
    const r = validateStyle({ hidden: ['meta:'] })
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('meta:')
  })

  it('warns on section: with empty key', () => {
    const r = validateStyle({ hidden: ['section:'] })
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('section')
  })

  it('warns on column:unknownName', () => {
    const r = validateStyle({ hidden: ['column:notReal'] })
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('column:notReal')
    expect(r.warnings[0]).toContain('notReal')
  })

  it('warns on block:bogus', () => {
    const r = validateStyle({ hidden: ['block:bogus'] })
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('block:bogus')
  })

  it('warns on meta:nonsense', () => {
    const r = validateStyle({ hidden: ['meta:nonsense'] })
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('meta:nonsense')
  })

  it('warns on empty string entry', () => {
    const r = validateStyle({ hidden: [''] })
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('empty')
  })
})

describe('validateStyle — section: cross-validation against sectionNames (C3)', () => {
  it('warns when section: references unknown section (sectionNames provided)', () => {
    const r = validateStyle({ hidden: ['section:unknown'] }, ['terms', 'warranty'])
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('unknown')
  })

  it('does not warn when section: matches a known section', () => {
    const r = validateStyle({ hidden: ['section:terms'] }, ['terms', 'warranty'])
    expect(r.warnings).toHaveLength(0)
  })

  it('does not warn when sectionNames is undefined (resolution-only mode)', () => {
    const r = validateStyle({ hidden: ['section:anything'] })
    expect(r.warnings).toHaveLength(0)
  })
})

describe('validateStyle — case-insensitive "did you mean" hint (I1)', () => {
  it('suggests "tax" when user wrote "Tax"', () => {
    const r = validateStyle({ hidden: ['Tax'] })
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('Did you mean "tax"')
  })

  it('suggests "payment" when user wrote "PAYMENT"', () => {
    const r = validateStyle({ hidden: ['PAYMENT'] })
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('Did you mean "payment"')
  })

  it('omits hint when no case-insensitive match exists', () => {
    const r = validateStyle({ hidden: ['totallyMadeUp'] })
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).not.toContain('Did you mean')
  })
})

// ─── Markdown header — expiryDate and creditNoteReference (C1) ───────────────

describe('toMarkdown — header meta fields (C1)', () => {
  it('renders expiryDate as "**Expires:**" line', () => {
    const doc = makeDoc({
      meta: {
        documentType: 'invoice',
        number: 'INV-001',
        issueDate: '2026-01-15',
        currency: 'USD',
        expiryDate: '2026-02-15',
      },
    })
    const md = toMarkdown(doc)
    expect(md).toContain('**Expires:** 2026-02-15')
  })

  it('renders creditNoteReference as "**Ref:**" line', () => {
    const doc = makeDoc({
      meta: {
        documentType: 'credit_note',
        number: 'CN-001',
        issueDate: '2026-01-15',
        currency: 'USD',
        creditNoteReference: 'INV-099',
      },
    })
    const md = toMarkdown(doc)
    expect(md).toContain('**Ref:** INV-099')
  })

  it('hides expiryDate when listed in style.hidden', () => {
    const doc = makeDoc({
      meta: {
        documentType: 'invoice',
        number: 'INV-001',
        issueDate: '2026-01-15',
        currency: 'USD',
        expiryDate: '2026-02-15',
      },
      style: { hidden: ['expiryDate'] },
    })
    const md = toMarkdown(doc)
    expect(md).not.toContain('Expires')
    expect(md).not.toContain('2026-02-15')
  })

  it('hides creditNoteReference when listed in style.hidden via meta: prefix', () => {
    const doc = makeDoc({
      meta: {
        documentType: 'credit_note',
        number: 'CN-001',
        issueDate: '2026-01-15',
        currency: 'USD',
        creditNoteReference: 'INV-099',
      },
      style: { hidden: ['meta:creditNoteReference'] },
    })
    const md = toMarkdown(doc)
    expect(md).not.toContain('INV-099')
  })
})

// ─── from/to wrapper — single party hidden (I4) ──────────────────────────────

describe('toHTML — single party hidden (I4)', () => {
  it('hides "from" only: "to" still renders without parties wrapper', () => {
    const doc = makeDoc({ style: { hidden: ['from'] } })
    const html = toHTML(doc)
    expect(html).not.toContain('invoml-parties"')
    expect(html).toContain('invoml-party-to')
    expect(html).not.toContain('invoml-party-from')
  })

  it('hides "to" only: "from" still renders without parties wrapper', () => {
    const doc = makeDoc({ style: { hidden: ['to'] } })
    const html = toHTML(doc)
    expect(html).not.toContain('invoml-parties"')
    expect(html).toContain('invoml-party-from')
    expect(html).not.toContain('invoml-party-to')
  })
})

// ─── style.order + style.hidden interaction (§6.8.5) ─────────────────────────

describe('style.order + style.hidden — hidden takes precedence', () => {
  it('hidden block in custom order is suppressed (HTML)', () => {
    const doc = makeDoc({
      style: {
        order: ['header', 'items', 'payment', 'notes'],
        hidden: ['payment'],
      },
    })
    const html = toHTML(doc)
    // The class .invoml-payment exists in BASE_CSS — match the rendered block element instead
    expect(html).not.toContain('data-invoml-block="payment"')
  })

  it('hidden block in custom order is suppressed (markdown)', () => {
    const doc = makeDoc({
      style: {
        order: ['header', 'items', 'payment', 'notes'],
        hidden: ['notes'],
      },
    })
    const md = toMarkdown(doc)
    expect(md).not.toContain('Thank you!')
  })
})

// ─── Category sets are pairwise disjoint (M1) ────────────────────────────────

describe('hidden name categories are disjoint', () => {
  it('COLUMN_NAMES and RESERVED_BLOCK_NAMES have empty intersection', () => {
    const cols = new Set(COLUMN_NAMES as ReadonlyArray<string>)
    const blocks: ReadonlyArray<string> = ['header', 'from', 'to', 'items', 'totals', 'payment', 'notes']
    for (const b of blocks) expect(cols.has(b)).toBe(false)
  })

  it('COLUMN_NAMES and META_FIELD_NAMES have empty intersection', () => {
    const cols = new Set(COLUMN_NAMES as ReadonlyArray<string>)
    for (const m of META_FIELD_NAMES) expect(cols.has(m)).toBe(false)
  })
})
