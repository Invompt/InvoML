import { describe, it, expect } from 'vitest'
import { resolveTaxConfig, resolveCategory } from '../src/tax.js'

describe('resolveTaxConfig', () => {
  it('returns null when no tax', () => { expect(resolveTaxConfig(undefined)).toBeNull() })

  it('converts simple form to categories', () => {
    const result = resolveTaxConfig({ label: 'VAT', rate: 21 })
    expect(result).not.toBeNull()
    expect(result!.categories).toHaveLength(1)
    expect(result!.categories[0].id).toBe('vat')
    expect(result!.categories[0].rate).toBe(21)
    expect(result!.categories[0].default).toBe(true)
  })

  it('generates hyphenated ID from label', () => {
    const result = resolveTaxConfig({ label: 'Sales Tax', rate: 8 })
    expect(result!.categories[0].id).toBe('sales-tax')
  })

  it('passes through categories form', () => {
    const result = resolveTaxConfig({
      system: 'vat',
      categories: [
        { id: 'S', label: 'VAT 21%', rate: 21, default: true },
        { id: 'R', label: 'VAT 10%', rate: 10 },
      ],
    })
    expect(result!.categories).toHaveLength(2)
    expect(result!.compound).toBe(false)
  })

  it('handles compound flag', () => {
    const result = resolveTaxConfig({
      system: 'compound', compound: true,
      categories: [
        { id: 'gst', label: 'GST', rate: 5 },
        { id: 'pst', label: 'PST', rate: 7 },
      ],
    })
    expect(result!.compound).toBe(true)
  })

  it('handles inclusive flag on simple form', () => {
    const result = resolveTaxConfig({ label: 'GST', rate: 10, inclusive: true })
    expect(result!.inclusive).toBe(true)
    expect(result!.categories[0].inclusive).toBe(true)
  })
})

describe('resolveCategory', () => {
  const config = resolveTaxConfig({
    categories: [
      { id: 'S', label: 'VAT', rate: 21, default: true },
      { id: 'R', label: 'Reduced', rate: 10 },
    ],
  })!

  it('resolves explicit taxCategory', () => {
    expect(resolveCategory({ taxCategory: 'R' } as any, config).id).toBe('R')
  })

  it('falls back to default', () => {
    expect(resolveCategory({} as any, config).id).toBe('S')
  })

  it('throws for unknown category', () => {
    expect(() => resolveCategory({ taxCategory: 'X' } as any, config)).toThrow('Unknown tax category')
  })

  it('throws when no default and no taxCategory', () => {
    const noDefault = resolveTaxConfig({
      categories: [
        { id: 'S', label: 'VAT', rate: 21 },
        { id: 'R', label: 'Reduced', rate: 10 },
      ],
    })!
    expect(() => resolveCategory({ description: 'Test' } as any, noDefault)).toThrow('no default')
  })
})
