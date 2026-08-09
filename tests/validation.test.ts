// tests/validation.test.ts

import { describe, it, expect } from 'vitest'
import { validate } from '../src/validation.js'
import type { InvoMLDocument } from '../src/types.js'

const validDoc: InvoMLDocument = {
  $invoml: '1.0',
  meta: {
    documentType: 'invoice',
    number: 'INV-001',
    issueDate: '2026-01-15',
    currency: 'USD',
  },
  items: [{ description: 'Widget', quantity: 2, unitPrice: 50 }],
}

function clone(doc: InvoMLDocument): InvoMLDocument {
  return JSON.parse(JSON.stringify(doc)) as InvoMLDocument
}

describe('validate()', () => {
  it('returns valid with no issues for a well-formed document', () => {
    const result = validate(validDoc)
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  // ── Error rules ──

  it('errors on invalid currency code', () => {
    const doc = clone(validDoc)
    doc.meta.currency = 'ZZZ'
    const result = validate(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'INVALID_CURRENCY', path: 'meta.currency' }),
    )
  })

  it('errors on empty items array', () => {
    const doc = clone(validDoc)
    doc.items = []
    const result = validate(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'EMPTY_ITEMS', path: 'items' }),
    )
  })

  it('errors on zero quantity and reports correct path', () => {
    const doc = clone(validDoc)
    doc.items = [
      { description: 'First', quantity: 1, unitPrice: 10 },
      { description: 'Second', quantity: 0, unitPrice: 20 },
    ]
    const result = validate(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'ZERO_QUANTITY', path: 'items[1].quantity' }),
    )
  })

  it('allows negative quantity as a signed domain-valid value', () => {
    const doc = clone(validDoc)
    doc.items = [
      { description: 'First', quantity: 1, unitPrice: 10 },
      { description: 'Bad', quantity: -5, unitPrice: 20 },
    ]
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(issue => issue.path === 'items[1].quantity').length).toBe(0)
  })

  it('allows negative unit price as a signed domain-valid value', () => {
    const doc = clone(validDoc)
    doc.items = [{ description: 'Widget', quantity: 2, unitPrice: -10 }]
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.filter(issue => issue.path === 'items[0].unitPrice').length).toBe(0)
  })

  it('allows zero unit price (free items are valid)', () => {
    const doc = clone(validDoc)
    doc.items = [{ description: 'Free sample', quantity: 1, unitPrice: 0 }]
    const result = validate(doc)
    expect(result.issues.filter(i => i.code === 'NEGATIVE_UNIT_PRICE')).toHaveLength(0)
  })

  it('errors on empty meta.number', () => {
    const doc = clone(validDoc)
    doc.meta.number = ''
    const result = validate(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'EMPTY_NUMBER', path: 'meta.number' }),
    )
  })

  it('errors on whitespace-only meta.number', () => {
    const doc = clone(validDoc)
    doc.meta.number = '   '
    const result = validate(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'EMPTY_NUMBER', path: 'meta.number' }),
    )
  })

  // ── Warning rules ──

  it('warns when dueDate is before issueDate — valid remains true', () => {
    const doc = clone(validDoc)
    doc.meta.issueDate = '2026-06-01'
    doc.meta.dueDate = '2026-05-01'
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'warning', code: 'DUE_BEFORE_ISSUE', path: 'meta.dueDate' }),
    )
  })

  it('warns when issueDate is more than 1 year in the past', () => {
    const doc = clone(validDoc)
    doc.meta.issueDate = '2020-01-01'
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'warning', code: 'ISSUE_DATE_TOO_OLD', path: 'meta.issueDate' }),
    )
  })

  it('warns when issueDate is more than 1 year in the future', () => {
    const doc = clone(validDoc)
    doc.meta.issueDate = '2030-01-01'
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'warning', code: 'ISSUE_DATE_FUTURE', path: 'meta.issueDate' }),
    )
  })

  it('does not warn for issueDate within 1 year of today', () => {
    const doc = clone(validDoc)
    // Use a date that is always within range — today
    const today = new Date().toISOString().slice(0, 10)
    doc.meta.issueDate = today
    const result = validate(doc)
    expect(result.issues.filter(i => i.code === 'ISSUE_DATE_TOO_OLD' || i.code === 'ISSUE_DATE_FUTURE')).toHaveLength(0)
  })

  it('warns on duplicate item descriptions (case-insensitive)', () => {
    const doc = clone(validDoc)
    doc.items = [
      { description: 'Widget', quantity: 1, unitPrice: 10 },
      { description: 'widget', quantity: 2, unitPrice: 20 },
    ]
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'warning', code: 'DUPLICATE_DESCRIPTION', path: 'items[1].description' }),
    )
  })

  it('warns when calculated total exceeds 10,000,000', () => {
    const doc = clone(validDoc)
    doc.items = [{ description: 'Big item', quantity: 1, unitPrice: 10_000_001 }]
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'warning', code: 'LARGE_TOTAL', path: 'items' }),
    )
  })

  it('does not warn for total exactly at the threshold', () => {
    const doc = clone(validDoc)
    doc.items = [{ description: 'Threshold item', quantity: 1, unitPrice: 10_000_000 }]
    const result = validate(doc)
    expect(result.issues.filter(i => i.code === 'LARGE_TOTAL')).toHaveLength(0)
  })

  // ── Accumulation ──

  it('accumulates multiple issues from different rules', () => {
    const doc = clone(validDoc)
    doc.meta.currency = 'FAKE'
    doc.meta.number = ''
    doc.items = [
      { description: 'A', quantity: 1, unitPrice: 10 },
      { description: 'A', quantity: 1, unitPrice: 10 },
    ]
    const result = validate(doc)
    expect(result.valid).toBe(false)
    const codes = result.issues.map(i => i.code)
    expect(codes).toContain('INVALID_CURRENCY')
    expect(codes).toContain('EMPTY_NUMBER')
    expect(codes).toContain('DUPLICATE_DESCRIPTION')
    expect(result.issues.length).toBeGreaterThanOrEqual(3)
  })

  it('errors on lowercase currency code (VALID_CURRENCIES uses uppercase only)', () => {
    const doc = clone(validDoc)
    doc.meta.currency = 'usd'
    const result = validate(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'INVALID_CURRENCY', path: 'meta.currency' }),
    )
  })

  it('errors on empty string currency', () => {
    const doc = clone(validDoc)
    doc.meta.currency = ''
    const result = validate(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'INVALID_CURRENCY', path: 'meta.currency' }),
    )
  })

  it('errors on malformed issueDate with INVALID_DATE_FORMAT', () => {
    const doc = clone(validDoc)
    doc.meta.issueDate = 'not-a-date'
    const result = validate(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'INVALID_DATE_FORMAT', path: 'meta.issueDate' }),
    )
  })

  it('errors on impossible calendar issueDate values', () => {
    const doc = clone(validDoc)
    doc.meta.issueDate = '2026-02-31'
    const result = validate(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'INVALID_DATE_FORMAT', path: 'meta.issueDate' }),
    )
  })

  it('errors on malformed dueDate with INVALID_DATE_FORMAT', () => {
    const doc = clone(validDoc)
    doc.meta.dueDate = '2026-13-01'
    const result = validate(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'INVALID_DATE_FORMAT', path: 'meta.dueDate' }),
    )
  })

  it('errors on malformed expiryDate with INVALID_DATE_FORMAT', () => {
    const doc = clone(validDoc)
    doc.meta.expiryDate = '2026-00-10'
    const result = validate(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'INVALID_DATE_FORMAT', path: 'meta.expiryDate' }),
    )
  })

  it('errors when an item references an unknown tax category', () => {
    const doc = clone(validDoc)
    doc.meta.tax = {
      categories: [{ id: 'vat', label: 'VAT', rate: 10, default: true }],
    }
    doc.items = [{ description: 'Widget', quantity: 2, unitPrice: 50, taxCategory: 'missing' }]
    const result = validate(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'UNKNOWN_CATEGORY', path: 'items[0].taxCategory' }),
    )
  })

  it('errors when items omit taxCategory and there is no default category', () => {
    const doc = clone(validDoc)
    doc.meta.tax = {
      categories: [{ id: 'vat', label: 'VAT', rate: 10 }],
    }
    const result = validate(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'NO_DEFAULT_CATEGORY', path: 'meta.tax.categories' }),
    )
  })

  it('errors when items omit taxCategory and multiple default categories are configured', () => {
    const doc = clone(validDoc)
    doc.meta.tax = {
      categories: [
        { id: 'vat', label: 'VAT', rate: 10, default: true },
        { id: 'reduced', label: 'Reduced', rate: 5, default: true },
      ],
    }
    const result = validate(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ level: 'error', code: 'MULTIPLE_DEFAULT_CATEGORIES', path: 'meta.tax.categories' }),
    )
  })

  it('warnings alone do not make valid false', () => {
    const doc = clone(validDoc)
    doc.meta.issueDate = '2020-01-01'
    doc.meta.dueDate = '2019-12-01'
    doc.items = [
      { description: 'Same', quantity: 1, unitPrice: 10 },
      { description: 'same', quantity: 1, unitPrice: 10 },
    ]
    const result = validate(doc)
    expect(result.valid).toBe(true)
    expect(result.issues.every(i => i.level === 'warning')).toBe(true)
    expect(result.issues.length).toBeGreaterThan(0)
  })
})
