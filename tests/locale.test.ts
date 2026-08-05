import { describe, expect, it } from 'vitest'
import { calculate } from '../src/calculator.js'
import { toHTML } from '../src/html-renderer.js'
import {
  resolveInvoiceLocale,
  SUPPORTED_INVOICE_LOCALES,
} from '../src/locale.js'
import type { InvoMLDocument } from '../src/types.js'

function document(locale: string, prepaidAmount = 20): InvoMLDocument {
  const source: InvoMLDocument = {
    $invoml: '1.0',
    meta: {
      documentType: 'invoice',
      number: 'INV-LOCALE-001',
      issueDate: '2026-07-27',
      dueDate: '2026-08-27',
      currency: 'USD',
      locale,
      tax: { label: 'VAT', rate: 10, inclusive: true },
    },
    from: {
      name: 'FICTIONAL SAMPLE MAPLE CRATE CO',
      attention: 'Finance',
      taxId: 'EXAMPLE-TAX-ID',
      businessNumber: 'EXAMPLE-BUSINESS-ID',
    },
    to: { name: 'FICTIONAL SAMPLE RIVER MARKET CO' },
    items: [
      {
        description: 'Storage crate',
        quantity: 1,
        unit: 'box',
        unitPrice: 100,
        discount: { type: 'percentage', value: 10 },
      },
    ],
    payment: {
      beneficiary: 'FICTIONAL SAMPLE MAPLE CRATE CO',
      bank: 'EXAMPLE BANK',
      routingNumber: 'EXAMPLE-ROUTING',
      accountNumber: 'EXAMPLE-ACCOUNT',
    },
    prepaidAmount,
  }
  return { ...source, totals: calculate(source) }
}

describe('invoice locale resolution', () => {
  it('exposes a broad stable locale catalog', () => {
    expect(SUPPORTED_INVOICE_LOCALES).toEqual(expect.arrayContaining([
      'en', 'es', 'pt', 'fr', 'de', 'it', 'nl', 'pl', 'tr', 'id',
      'th', 'vi', 'ja', 'ko', 'zh-CN', 'zh-TW', 'ar', 'he', 'hi', 'ru',
    ]))
    expect(SUPPORTED_INVOICE_LOCALES.length).toBeGreaterThanOrEqual(20)
  })

  it('resolves regional BCP 47 tags by language without keyword matching', () => {
    expect(resolveInvoiceLocale('es-AR').locale).toBe('es')
    expect(resolveInvoiceLocale('pt-BR').locale).toBe('pt')
    expect(resolveInvoiceLocale('zh-Hant-HK').locale).toBe('zh-TW')
    expect(resolveInvoiceLocale('zh-SG').locale).toBe('zh-CN')
  })

  it('falls back to English for unknown or malformed locale tags', () => {
    expect(resolveInvoiceLocale('xx-Unknown').locale).toBe('en')
    expect(resolveInvoiceLocale('').locale).toBe('en')
  })

  it('marks Arabic and Hebrew as right-to-left', () => {
    expect(resolveInvoiceLocale('ar-SA').direction).toBe('rtl')
    expect(resolveInvoiceLocale('he-IL').direction).toBe('rtl')
    expect(resolveInvoiceLocale('es-ES').direction).toBe('ltr')
  })
})

describe('localized HTML rendering', () => {
  it('renders Spanish labels semantically before HTML is produced', () => {
    const html = toHTML(document('es-AR'))

    expect(html).toContain('<html lang="es" dir="ltr">')
    expect(html).toContain('data-invoml-locale="es"')
    expect(html).toContain('>Factura<')
    expect(html).toContain('>Emisor<')
    expect(html).toContain('>Cliente<')
    expect(html).toContain('>Descripción<')
    expect(html).toContain('>Cantidad<')
    expect(html).toContain('>Precio unitario<')
    expect(html).toContain('>Total a pagar<')
    expect(html).not.toContain('>Bill To<')
    expect(html).not.toContain('>Unit Price<')
  })

  it('renders Thai and Japanese without an English-label replacement pass', () => {
    const thai = toHTML(document('th-TH'))
    const japanese = toHTML(document('ja-JP'))

    expect(thai).toContain('ใบแจ้งหนี้')
    expect(thai).toContain('ราคาต่อหน่วย')
    expect(thai).toContain('ยอดที่ต้องชำระ')
    expect(japanese).toContain('請求書')
    expect(japanese).toContain('単価')
    expect(japanese).toContain('お支払額')
  })

  it('renders Arabic labels and direction on both document and invoice surface', () => {
    const html = toHTML(document('ar-AE'))

    expect(html).toContain('<html lang="ar" dir="rtl">')
    expect(html).toContain('lang="ar" dir="rtl" data-invoml-locale="ar"')
    expect(html).toContain('فاتورة')
    expect(html).toContain('المبلغ المستحق')
  })
})
