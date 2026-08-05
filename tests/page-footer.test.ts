import { describe, expect, it } from 'vitest'
import { resolvePageFooter, validateStyle } from '../src/style.js'
import { resolveInvoiceLocale } from '../src/locale.js'
import { toHTML } from '../src/html-renderer.js'
import type { InvoMLDocument } from '../src/types.js'

function makeDoc(overrides: Partial<InvoMLDocument> = {}): InvoMLDocument {
  return {
    $invoml: '1.0',
    meta: { documentType: 'invoice', number: 'INV-001', issueDate: '2026-01-01', currency: 'USD' },
    items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    ...overrides,
  }
}

describe('resolvePageFooter', () => {
  it('defaults to show=true with locale format', () => {
    expect(resolvePageFooter(makeDoc())).toEqual({ show: true, format: 'Page {page} of {pages}' })
  })

  it('uses Spanish locale format', () => {
    expect(resolvePageFooter(makeDoc({ meta: { ...makeDoc().meta, locale: 'es' } })))
      .toEqual({ show: true, format: 'Página {page} de {pages}' })
  })

  it('uses Japanese locale format', () => {
    expect(resolvePageFooter(makeDoc({ meta: { ...makeDoc().meta, locale: 'ja' } })))
      .toEqual({ show: true, format: '{page} / {pages} ページ' })
  })

  it('uses Arabic locale format', () => {
    expect(resolvePageFooter(makeDoc({ meta: { ...makeDoc().meta, locale: 'ar' } })))
      .toEqual({ show: true, format: 'صفحة {page} من {pages}' })
  })

  it('hides when show is false', () => {
    expect(resolvePageFooter(makeDoc({ style: { pageFooter: { show: false } } })))
      .toEqual({ show: false, format: 'Page {page} of {pages}' })
  })

  it('uses custom format when provided', () => {
    expect(resolvePageFooter(makeDoc({ style: { pageFooter: { format: '{page}' } } })))
      .toEqual({ show: true, format: '{page}' })
  })

  it('custom format overrides even when show is omitted', () => {
    expect(resolvePageFooter(makeDoc({ style: { pageFooter: { format: 'Page {page}' } } })))
      .toEqual({ show: true, format: 'Page {page}' })
  })
})

describe('validateStyle pageFooter', () => {
  it('accepts valid pageFooter with show and format', () => {
    expect(validateStyle({ pageFooter: { show: true, format: 'Page {page} of {pages}' } }))
      .toEqual({ valid: true, errors: [], warnings: [] })
  })

  it('accepts pageFooter with only format', () => {
    expect(validateStyle({ pageFooter: { format: '{page}' } })).toEqual({ valid: true, errors: [], warnings: [] })
  })

  it('accepts pageFooter with only show', () => {
    expect(validateStyle({ pageFooter: { show: false } })).toEqual({ valid: true, errors: [], warnings: [] })
  })

  it('rejects missing {page} placeholder', () => {
    const result = validateStyle({ pageFooter: { format: 'Page' } })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('{page}')
  })

  it('rejects invalid placeholders', () => {
    const result = validateStyle({ pageFooter: { format: 'Page {page} of {total}' } })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('{total}')
  })

  it('rejects format > 120 chars', () => {
    const result = validateStyle({ pageFooter: { format: 'a'.repeat(121) + '{page}' } })
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('120')
  })

  it('rejects non-boolean show', () => {
    const result = validateStyle({ pageFooter: { show: 'yes' } } as any)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('boolean')
  })

  it('rejects non-string format', () => {
    const result = validateStyle({ pageFooter: { format: 123 } } as any)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('string')
  })

  it('rejects unknown keys', () => {
    const result = validateStyle({ pageFooter: { show: true, align: 'center' } } as any)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('align')
  })
})

describe('HTML output pageFooter attributes', () => {
  it('emits show + format attributes by default', () => {
    const html = toHTML(makeDoc({ style: { pageFooter: { format: 'Page {page} of {pages}' } } }))
    expect(html).toContain('data-invoml-page-footer="show"')
    expect(html).toContain('data-invoml-page-footer-format="Page {page} of {pages}"')
  })

  it('emits hidden when show is false', () => {
    const html = toHTML(makeDoc({ style: { pageFooter: { show: false } } }))
    expect(html).toContain('data-invoml-page-footer="hidden"')
    expect(html).not.toContain('data-invoml-page-footer-format')
  })

  it('escapes HTML metacharacters in format', () => {
    const html = toHTML(makeDoc({ style: { pageFooter: { format: 'Page <b>{page}</b>' } } }))
    expect(html).toContain('data-invoml-page-footer-format="Page &lt;b&gt;{page}&lt;/b&gt;"')
    expect(html).not.toContain('<b>{page}</b>')
  })
})

describe('InvoiceLabels pagination', () => {
  it.each([
    'en', 'es', 'pt', 'fr', 'de', 'it', 'nl', 'pl', 'tr', 'id',
    'th', 'vi', 'ja', 'ko', 'zh-CN', 'zh-TW', 'ar', 'he', 'hi', 'ru',
  ])('locale %s has pagination.format containing {page}', (locale) => {
    const resolved = resolveInvoiceLocale(locale)
    expect(resolved.labels.pagination.format).toContain('{page}')
  })
})
