import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'

describe('parse', () => {
  const minimal = JSON.stringify({
    $invoml: '1.0',
    meta: { documentType: 'invoice', number: 'INV-001', issueDate: '2026-01-01', currency: 'USD' },
    from: { name: 'FICTIONAL SAMPLE COPPER QUILL CO' },
    to: { name: 'FICTIONAL SAMPLE INDIGO MARKET CO' },
    items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
  })

  it('parses valid JSON into InvoMLDocument', () => {
    const result = parse(minimal)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.document.meta.number).toBe('INV-001')
      expect(result.document.items).toHaveLength(1)
    }
  })

  it('returns error for invalid JSON', () => {
    const result = parse('not json')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]).toContain('Invalid JSON')
    }
  })

  it('returns error for empty string', () => {
    const result = parse('')
    expect(result.success).toBe(false)
  })

  it('returns validation errors for missing required fields', () => {
    const result = parse(JSON.stringify({ $invoml: '1.0' }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0)
    }
  })

  it('returns validation error for invalid documentType', () => {
    const result = parse(JSON.stringify({
      $invoml: '1.0',
      meta: { documentType: 'order', number: 'X', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'A', quantity: 1, unitPrice: 1 }],
    }))
    expect(result.success).toBe(false)
  })

  it('accepts all valid document types', () => {
    for (const type of ['invoice', 'quote', 'receipt']) {
      const result = parse(JSON.stringify({
        $invoml: '1.0',
        meta: { documentType: type, number: 'X', issueDate: '2026-01-01', currency: 'USD' },
        items: [{ description: 'A', quantity: 1, unitPrice: 1 }],
      }))
      expect(result.success).toBe(true)
    }
  })

  it('accepts credit_note with required creditNoteReference', () => {
    const result = parse(JSON.stringify({
      $invoml: '1.0',
      meta: { documentType: 'credit_note', number: 'CN-001', issueDate: '2026-01-01', currency: 'USD', creditNoteReference: 'INV-001' },
      items: [{ description: 'Refund', quantity: 1, unitPrice: -100 }],
    }))
    expect(result.success).toBe(true)
  })

  it('parses structured address lines without normalizing explicit blanks or Unicode', () => {
    const result = parse(JSON.stringify({
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-RTL', issueDate: '2024-02-29', currency: 'JPY' },
      to: { address: { lines: ['サンプル所在地', '', 'موقع تجريبي'] } },
      items: [{ description: 'A', quantity: 1, unitPrice: 1 }],
    }))

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.document.to?.address?.lines).toEqual(['サンプル所在地', '', 'موقع تجريبي'])
    }
  })

  it('rejects mixed party representations', () => {
    const result = parse(JSON.stringify({
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-MIXED', issueDate: '2026-01-01', currency: 'USD' },
      from: { content: 'FICTIONAL SAMPLE LANTERN QUILL CO', email: 'billing@parser.example.invalid' },
      items: [{ description: 'A', quantity: 1, unitPrice: 1 }],
    }))
    expect(result.success).toBe(false)
  })

  it('rejects an invalid date presentation preset', () => {
    const result = parse(JSON.stringify({
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-DATE', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'A', quantity: 1, unitPrice: 1 }],
      style: { dateFormat: 'full' },
    }))
    expect(result.success).toBe(false)
  })
})
