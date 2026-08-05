import { describe, it, expect } from 'vitest'
import { validateSchema } from '../src/schema.js'

describe('validateSchema', () => {
  const validDoc = {
    $invoml: '1.0',
    meta: { documentType: 'invoice', number: 'INV-001', issueDate: '2026-01-01', currency: 'USD' },
    items: [{ description: 'Widget', quantity: 2, unitPrice: 50 }],
  }

  it('passes for valid minimal document', () => {
    const result = validateSchema(validDoc)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('fails for missing $invoml', () => {
    const { $invoml, ...doc } = validDoc
    const result = validateSchema(doc)
    expect(result.valid).toBe(false)
  })

  it('fails for missing meta', () => {
    const { meta, ...doc } = validDoc
    const result = validateSchema(doc)
    expect(result.valid).toBe(false)
  })

  it('fails for missing items', () => {
    const { items, ...doc } = validDoc
    const result = validateSchema(doc)
    expect(result.valid).toBe(false)
  })

  it('fails for empty items array', () => {
    const result = validateSchema({ ...validDoc, items: [] })
    expect(result.valid).toBe(false)
  })

  it('fails for invalid documentType', () => {
    const result = validateSchema({
      ...validDoc,
      meta: { ...validDoc.meta, documentType: 'purchase_order' },
    })
    expect(result.valid).toBe(false)
  })

  it('passes with all optional fields', () => {
    const result = validateSchema({
      ...validDoc,
      from: { name: 'FICTIONAL SAMPLE COPPER QUILL CO', address: { lines: ['Sample business location'] }, taxId: 'EXAMPLE-TAX-ID' },
      to: { name: 'FICTIONAL SAMPLE INDIGO MARKET CO', email: 'buyer@schema.example.invalid' },
      payment: { method: 'bank-international', iban: 'EXAMPLE-IBAN-SCHEMA' },
      notes: 'Thank you',
    })
    expect(result.valid).toBe(true)
  })

  it('accepts free-form parties without structured fields', () => {
    const result = validateSchema({
      ...validDoc,
      from: { content: '**FICTIONAL SAMPLE COPPER QUILL CO**\r\nSample City, Singapore' },
    })
    expect(result.valid).toBe(true)
  })

  it('rejects a party that mixes free-form content and structured fields', () => {
    const result = validateSchema({
      ...validDoc,
      from: { content: '**FICTIONAL SAMPLE LANTERN QUILL CO**', name: 'FICTIONAL SAMPLE LANTERN QUILL CO' },
    })
    expect(result.valid).toBe(false)
  })

  it('rejects an empty party', () => {
    expect(validateSchema({ ...validDoc, to: {} }).valid).toBe(false)
  })

  it('accepts structured address lines with blank, Unicode, and RTL entries', () => {
    const result = validateSchema({
      ...validDoc,
      to: {
        name: 'FICTIONAL SAMPLE POLYGLOT PAPER CO',
        address: {
          lines: ['サンプル所在地', '', 'موقع تجريبي', 'מיקום לדוגמה'],
        },
      },
    })
    expect(result.valid).toBe(true)
  })

  it('rejects legacy string addresses and embedded CRLF in structured lines', () => {
    expect(validateSchema({
      ...validDoc,
      to: { address: 'Line one\nLine two' },
    }).valid).toBe(false)

    expect(validateSchema({
      ...validDoc,
      to: { address: { lines: ['Line one\r\nLine two'] } },
    }).valid).toBe(false)
  })

  it('accepts every date presentation preset and rejects unknown presets', () => {
    for (const dateFormat of ['iso', 'numeric', 'medium', 'long']) {
      expect(validateSchema({
        ...validDoc,
        style: { dateFormat },
      }).valid).toBe(true)
    }

    expect(validateSchema({
      ...validDoc,
      style: { dateFormat: 'full' },
    }).valid).toBe(false)
  })

  it('returns descriptive error messages', () => {
    const result = validateSchema({ $invoml: '1.0' })
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('meta') || e.includes('items'))).toBe(true)
  })

  it('fails for non-object input', () => {
    expect(validateSchema('string').valid).toBe(false)
    expect(validateSchema(42).valid).toBe(false)
    expect(validateSchema(null).valid).toBe(false)
  })
})
