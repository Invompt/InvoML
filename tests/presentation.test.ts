import { describe, expect, it } from 'vitest'
import * as htmlRenderer from '../src/html-renderer.js'
import { validateSchema } from '../src/schema.js'
import { renderHTML, toHTML } from '../src/html-renderer.js'
import { resolveInvoiceLocale, SUPPORTED_INVOICE_LOCALES } from '../src/locale.js'
import { renderMarkdown, toJSON, toMarkdown } from '../src/serializer.js'
import { resolvePresentation } from '../src/presentation.js'
import { validate } from '../src/validation.js'
import type { InvoMLDocument } from '../src/types.js'

function invoice(overrides: Partial<InvoMLDocument> = {}): InvoMLDocument {
  return {
    $invoml: '1.0',
    meta: {
      documentType: 'invoice',
      number: 'INV-PA-001',
      issueDate: '2026-07-30',
      dueDate: '2026-08-30',
      currency: 'USD',
    },
    to: { name: 'FICTIONAL SAMPLE HARBOR MARKET CO' },
    items: [{ description: 'Storage crate', quantity: 2, unitPrice: 100 }],
    ...overrides,
  }
}

describe('presentation schema contract', () => {
  it('rejects document-authored raw CSS and unknown token values', () => {
    expect(validateSchema({
      ...invoice(),
      style: { properties: { color: 'red' } },
    }).valid).toBe(false)
    expect(validateSchema({
      ...invoice(),
      style: { blocks: { header: { color: 'red' } } },
    }).valid).toBe(false)
    expect(validateSchema({
      ...invoice(),
      style: { blocks: { header: { span: 'quarter' } } },
    }).valid).toBe(false)
    expect(validateSchema({
      ...invoice(),
      style: { blocks: { unknown: { span: 'full' } } },
    }).valid).toBe(false)
  })

  it('accepts the complete typed token vocabulary', () => {
    expect(validateSchema({
      ...invoice(),
      style: {
        template: 'professional',
        blocks: {
          header: {
            span: 'full',
            align: 'center',
            breakBefore: 'page',
            breakAfter: 'page',
            keepTogether: true,
          },
          from: { span: 'half' },
          to: { span: 'one-third' },
          'section:terms': { span: 'two-thirds' },
        },
      },
    }).valid).toBe(true)
  })

  it('rejects paymentAdvice.amountDue and unknown templates', () => {
    expect(validateSchema({
      ...invoice(),
      paymentAdvice: { amountDue: 1 },
    }).valid).toBe(false)
    expect(validateSchema({
      ...invoice(),
      style: { template: 'custom' },
    }).valid).toBe(false)
    expect(validateSchema({
      ...invoice(),
      paymentAdvice: { title: '' },
    }).valid).toBe(false)
  })
})

describe('single presentation resolver', () => {
  const doc = invoice({
    from: { name: 'FICTIONAL SAMPLE SILVER QUILL CO' },
    notes: 'Thank you',
    style: {
      template: 'professional',
      order: ['header', 'from', 'to', 'notes'],
      hidden: ['notes', 'unknown'],
      blocks: {
        from: { span: 'two-thirds', keepTogether: true },
        to: { span: 'half', align: 'end', breakAfter: 'page' },
      },
    },
  })

  it('returns output-only compatibility wrappers and diagnostic renderers', () => {
    expect(toHTML(doc)).toBe(renderHTML(doc).output)
    expect(toMarkdown(doc)).toBe(renderMarkdown(doc).output)
    expect(resolvePresentation(doc, 'html')).toEqual(renderHTML(doc))
  })

  it('emits deterministic sorted diagnostics with the stable shape', () => {
    const first = renderHTML(doc).diagnostics
    const second = renderHTML(doc).diagnostics
    const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
    expect(first).toEqual(second)
    expect(first).toEqual([...first].sort((a, b) =>
      compare(a.path, b.path)
      || compare(a.code, b.code)
      || compare(a.status, b.status)
      || compare(a.message, b.message)
    ))
    for (const finding of first) {
      expect(Object.keys(finding)).toEqual(['path', 'code', 'status', 'support', 'message'])
    }
    expect(first.map(finding => finding.code)).toEqual(expect.arrayContaining([
      'TEMPLATE_APPLIED',
      'ORDER_APPLIED',
      'BLOCK_RENDERED',
      'BLOCK_HIDDEN',
      'HIDDEN_REFERENCE_REJECTED',
      'BLOCK_TOKEN_APPLIED',
      'BLOCK_OMITTED_BY_ORDER',
    ]))
  })

  it('reports Markdown layout and template fallbacks without changing order', () => {
    const result = renderMarkdown(doc)
    expect(result.diagnostics.map(finding => finding.code)).toContain('TEMPLATE_TARGET_FALLBACK')
    expect(result.diagnostics.filter(finding => finding.code === 'BLOCK_TOKEN_TARGET_FALLBACK')).toHaveLength(5)
    expect(result.output.indexOf('# INVOICE')).toBeLessThan(result.output.indexOf('**From:**'))
    expect(result.output.indexOf('**From:**')).toBeLessThan(result.output.indexOf('**To:**'))
    expect(result.output).not.toContain('Thank you')
  })

  it('rejects unsupported runtime targets instead of falling through to Markdown', () => {
    expect(() => resolvePresentation(doc, 'pdf' as never)).toThrow(
      'Unsupported presentation target "pdf"',
    )
  })

  it('reports a single default decision for an empty runtime order', () => {
    const result = renderHTML(invoice({
      style: { order: [] as never },
    }))
    expect(result.diagnostics.filter(finding => finding.code === 'ORDER_REJECTED')).toHaveLength(1)
    expect(result.diagnostics.filter(finding => finding.code === 'ORDER_DEFAULTED')).toHaveLength(1)
  })
})

describe('HTML row and paged-media mapping', () => {
  it('groups exact-fit spans, starts overflow in a new row, and preserves DOM order', () => {
    const html = toHTML(invoice({
      from: { name: 'FICTIONAL SAMPLE SILVER QUILL CO' },
      notes: 'Last',
      style: {
        order: ['from', 'to', 'notes'],
        blocks: {
          from: { span: 'two-thirds' },
          to: { span: 'half' },
          notes: { span: 'one-third' },
        },
      },
    }))
    expect((html.match(/<div class="invoml-presentation-row" data-invoml-row/g) ?? [])).toHaveLength(2)
    expect(html.indexOf('data-invoml-block="from"')).toBeLessThan(html.indexOf('data-invoml-block="to"'))
    expect(html.indexOf('data-invoml-block="to"')).toBeLessThan(html.indexOf('data-invoml-block="notes"'))
  })

  it('renders from/to as half-width peers by default without authored style', () => {
    const html = toHTML(invoice({ from: { name: 'FICTIONAL SAMPLE SILVER QUILL CO' } }))
    const partyRow = html.match(
      /<div class="invoml-presentation-row" data-invoml-row>([\s\S]*?data-invoml-block="from"[\s\S]*?data-invoml-block="to"[\s\S]*?)<\/div>/,
    )?.[1]
    expect(partyRow).toContain('data-invoml-span="half"')
    expect((partyRow?.match(/data-invoml-span="half"/g) ?? [])).toHaveLength(2)
  })

  it('treats page breaks as row boundaries and places modern/legacy controls on rows', () => {
    const html = toHTML(invoice({
      from: { name: 'FICTIONAL SAMPLE SILVER QUILL CO' },
      style: {
        order: ['from', 'to'],
        blocks: {
          from: { span: 'half' },
          to: { span: 'half', breakBefore: 'page', breakAfter: 'page' },
        },
      },
    }))
    const rows = [...html.matchAll(/<div class="invoml-presentation-row" data-invoml-row([^>]*)>([\s\S]*?)<\/div>/g)]
    expect(rows).toHaveLength(2)
    expect(rows[0][2]).toContain('data-invoml-block="from"')
    expect(rows[0][2]).not.toContain('data-invoml-block="to"')
    expect(rows[1][1]).toContain('data-invoml-row-break-before="page"')
    expect(rows[1][1]).toContain('data-invoml-row-break-after="page"')
    expect(rows[1][2]).toContain('data-invoml-block="to"')
    expect(html).toContain('.invoml-presentation-row[data-invoml-row-break-before="page"]')
    expect(html).toContain('page-break-before: always')
    expect(html).toContain('page-break-after: always')
  })

  it('maps page and keep tokens to modern and legacy CSS', () => {
    const html = toHTML(invoice({
      style: {
        order: ['items'],
        blocks: {
          items: {
            breakBefore: 'page',
            breakAfter: 'page',
            keepTogether: true,
          },
        },
      },
    }))
    expect(html).toContain('break-before: page')
    expect(html).toContain('page-break-before: always')
    expect(html).toContain('break-after: page')
    expect(html).toContain('page-break-after: always')
    expect(html).toContain('break-inside: avoid')
    expect(html).toContain('page-break-inside: avoid')
    expect(html).toContain('overflow-wrap: anywhere')
  })
})

describe('payment advice', () => {
  it('is opt-in and absent by default', () => {
    expect(toHTML(invoice())).not.toContain('data-invoml-payment-advice')
    expect(toMarkdown(invoice())).not.toContain('Amount enclosed')
  })

  it('renders default content, computed fields, due date, customer and blank amount enclosed', () => {
    const doc = invoice({ paymentAdvice: {} })
    const html = toHTML(doc)
    const markdown = toMarkdown(doc)
    expect(html).toContain('data-invoml-block="paymentAdvice"')
    expect(html).toContain('data-invoml-payment-advice="computed"')
    expect(html).toContain('data-invoml-payment-advice-field="number"')
    expect(html).toContain('data-invoml-payment-advice-field="amountDue"')
    expect(html).toContain('data-invoml-payment-advice-field="amountEnclosed"')
    expect(html).toContain('data-invoml-computed contenteditable="false"')
    expect(markdown).toContain('### Payment Advice')
    expect(markdown).toContain('**Invoice number:** INV-PA-001')
    expect(markdown).toContain('**Due date:** 2026-08-30')
    expect(markdown).toContain('**Customer:** FICTIONAL SAMPLE HARBOR MARKET CO')
    expect(markdown).toContain('**Amount due:** 200.00')
    expect(markdown).toContain('**Amount enclosed:** ')
  })

  it('derives the customer from the first visible Markdown line', () => {
    const result = renderHTML(invoice({
      to: { content: '![Logo](https://logo.example.invalid/logo.png)\n**FICTIONAL SAMPLE COBALT MARKET CO**\nSample recipient location' },
      paymentAdvice: {},
    }))
    expect(result.output).toContain('>FICTIONAL SAMPLE COBALT MARKET CO</span>')
    expect(result.diagnostics.map(finding => finding.code)).not.toContain(
      'PAYMENT_ADVICE_CUSTOMER_MISSING',
    )
  })

  it('ignores raw HTML when deriving the payment-advice customer', () => {
    const result = renderMarkdown(invoice({
      to: { content: '<img src=x onerror=alert(1)>\n**FICTIONAL SAMPLE COBALT MARKET CO**\nSample recipient location' },
      paymentAdvice: {},
    }))
    expect(result.output).toContain('**Customer:** FICTIONAL SAMPLE COBALT MARKET CO')
    expect(result.output).not.toContain('**Customer:** <img')
  })

  it('honours authored title/content, order, and hidden state', () => {
    const authored = invoice({
      paymentAdvice: { title: 'Remittance Stub', content: 'Return this stub.' },
      style: { order: ['paymentAdvice', 'header'] },
    })
    const html = toHTML(authored)
    expect(html.indexOf('data-invoml-block="paymentAdvice"')).toBeLessThan(html.indexOf('data-invoml-block="header"'))
    expect(html).toContain('Remittance Stub')
    expect(html).toContain('Return this stub.')
    expect(toHTML({
      ...authored,
      style: { order: ['paymentAdvice'], hidden: ['paymentAdvice'] },
    })).not.toContain('data-invoml-payment-advice')
  })

  it('does not calculate or diagnose advice that is hidden or omitted by order', () => {
    const negative = invoice({ prepaidAmount: 201, paymentAdvice: {} })
    const hidden = renderHTML({
      ...negative,
      style: { hidden: ['paymentAdvice'] },
    })
    const omitted = renderHTML({
      ...negative,
      style: { order: ['header', 'items'] },
    })
    expect(hidden.diagnostics.map(finding => finding.code)).not.toContain('PAYMENT_ADVICE_AMOUNT_DUE_COMPUTED')
    expect(hidden.diagnostics.map(finding => finding.code)).not.toContain('PAYMENT_ADVICE_NEGATIVE_AMOUNT_DUE')
    expect(hidden.diagnostics.map(finding => finding.code)).toContain('BLOCK_HIDDEN')
    expect(omitted.diagnostics.map(finding => finding.code)).not.toContain('PAYMENT_ADVICE_AMOUNT_DUE_COMPUTED')
    expect(omitted.diagnostics.map(finding => finding.code)).not.toContain('PAYMENT_ADVICE_NEGATIVE_AMOUNT_DUE')
    expect(omitted.diagnostics.map(finding => finding.code)).toContain('BLOCK_OMITTED_BY_ORDER')
  })

  it('recalculates stale totals and item-derived values on every render', () => {
    const doc = invoice({
      paymentAdvice: {},
      items: [{ description: 'Storage crate', quantity: 2, unitPrice: 100, amount: 9999, taxAmount: 9999 }],
      totals: {
        subtotal: 9999,
        afterDiscounts: 9999,
        taxTotal: 0,
        withholdingTotal: 0,
        total: 9999,
        amountDue: 9999,
      },
    })
    expect(toMarkdown(doc)).toContain('**Amount due:** 200.00')
    doc.items[0].quantity = 3
    expect(toMarkdown(doc)).toContain('**Amount due:** 300.00')
  })

  it('uses tax, discounts, and prepaid amount in the computed amount due', () => {
    const doc = invoice({
      paymentAdvice: {},
      meta: {
        documentType: 'invoice',
        number: 'INV-PA-001',
        issueDate: '2026-07-30',
        currency: 'USD',
        tax: { label: 'VAT', rate: 10 },
      },
      discounts: [{ type: 'percentage', value: 10 }],
      prepaidAmount: 50,
    })
    expect(toMarkdown(doc)).toContain('**Amount due:** 148.00')
  })

  it.each([
    ['JPY', 1234, '1,234'],
    ['KWD', 1.234, '1.234'],
    ['USD', 0, '0.00'],
  ] as const)('formats %s payment advice using currency decimals', (currency, unitPrice, expected) => {
    const doc = invoice({
      meta: {
        documentType: 'invoice',
        number: 'INV-CURRENCY',
        issueDate: '2026-07-30',
        currency,
      },
      items: [{ description: 'Item', quantity: 1, unitPrice }],
      paymentAdvice: {},
    })
    expect(toMarkdown(doc)).toContain(`**Amount due:** ${expected}`)
  })

  it('accepts zero due and rejects negative due', () => {
    const zero = invoice({ prepaidAmount: 200, paymentAdvice: {} })
    expect(toHTML(zero)).toContain('data-invoml-payment-advice="computed"')
    const negative = invoice({ prepaidAmount: 201, paymentAdvice: {} })
    const result = renderHTML(negative)
    expect(result.output).not.toContain('data-invoml-payment-advice="computed"')
    expect(result.diagnostics.map(finding => finding.code)).toContain('PAYMENT_ADVICE_NEGATIVE_AMOUNT_DUE')
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({
      path: 'paymentAdvice',
      code: 'BLOCK_DATA_MISSING',
    }))
    expect(validate(negative).issues).toContainEqual(expect.objectContaining({
      level: 'error',
      path: 'paymentAdvice',
      code: 'PAYMENT_ADVICE_NEGATIVE_AMOUNT_DUE',
    }))
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects a non-finite computed amount due (%s)',
    prepaidAmount => {
      const invalid = invoice({ prepaidAmount, paymentAdvice: {} })
      const result = renderHTML(invalid)
      expect(result.output).not.toContain('data-invoml-payment-advice="computed"')
      expect(result.diagnostics).toContainEqual(expect.objectContaining({
        path: 'paymentAdvice.amountDue',
        code: 'PAYMENT_ADVICE_INVALID_AMOUNT_DUE',
      }))
      expect(validate(invalid).issues).toContainEqual(expect.objectContaining({
        level: 'error',
        path: 'paymentAdvice',
        code: 'PAYMENT_ADVICE_INVALID_AMOUNT_DUE',
      }))
    },
  )

  it('rejects non-invoices with a domain diagnostic', () => {
    const result = renderHTML(invoice({
      meta: {
        documentType: 'quote',
        number: 'Q-1',
        issueDate: '2026-07-30',
        currency: 'USD',
      },
      paymentAdvice: {},
    }))
    expect(result.output).not.toContain('data-invoml-payment-advice="computed"')
    expect(result.diagnostics.map(finding => finding.code)).toContain('PAYMENT_ADVICE_INVOICE_ONLY')
    expect(validate(invoice({
      meta: {
        documentType: 'quote',
        number: 'Q-1',
        issueDate: '2026-07-30',
        currency: 'USD',
      },
      paymentAdvice: {},
    })).issues).toContainEqual(expect.objectContaining({
      level: 'error',
      path: 'paymentAdvice',
      code: 'PAYMENT_ADVICE_INVOICE_ONLY',
    }))
  })

  it('diagnoses calculation failure and skips only the payment advice', () => {
    const result = renderHTML(invoice({
      meta: {
        documentType: 'invoice',
        number: 'INV-BROKEN',
        issueDate: '2026-07-30',
        currency: 'USD',
        tax: {
          categories: [{ id: 'standard', label: 'VAT', rate: 10, default: true }],
        },
      },
      items: [{ description: 'Broken', quantity: 1, unitPrice: 1, taxCategory: 'missing' }],
      paymentAdvice: {},
    }))
    expect(result.output).toContain('data-invoml-block="header"')
    expect(result.output).not.toContain('data-invoml-payment-advice="computed"')
    expect(result.diagnostics.map(finding => finding.code)).toEqual(expect.arrayContaining([
      'PRESENTATION_CALCULATION_FALLBACK',
      'PAYMENT_ADVICE_CALCULATION_FAILED',
    ]))
  })

  it('does not mutate input, keeps advice mirrors readonly in editable mode, and serializes authored advice only', () => {
    const doc = invoice({
      paymentAdvice: { title: 'Advice', content: 'Instructions' },
      totals: {
        subtotal: 999,
        afterDiscounts: 999,
        taxTotal: 0,
        withholdingTotal: 0,
        total: 999,
        amountDue: 999,
      },
    })
    const before = structuredClone(doc)
    const html = toHTML(doc, { editable: true })
    expect(doc).toEqual(before)
    expect(html).toMatch(/data-invoml-payment-advice-field="amountDue"[\s\S]*?contenteditable="false"/)
    expect(html).toContain('data-invoml-field="paymentAdvice.title" contenteditable="true" aria-label="Payment advice title"')
    expect(html).toContain('data-invoml-field="paymentAdvice.content" contenteditable="true" aria-label="Payment advice details"')
    const json = JSON.parse(toJSON(doc)) as Record<string, unknown>
    expect(json.paymentAdvice).toEqual({ title: 'Advice', content: 'Instructions' })
    expect(json.paymentAdvice).not.toHaveProperty('amountDue')
    expect(json.paymentAdvice).not.toHaveProperty('amountEnclosed')
  })

  it('derives the customer from the first non-empty visible free-form line', () => {
    const markdown = toMarkdown(invoice({
      to: { content: '\n   \n**FICTIONAL SAMPLE BEACON MARKET CO**\nSample recipient location' },
      paymentAdvice: {},
    }))
    expect(markdown).toContain('**Customer:** FICTIONAL SAMPLE BEACON MARKET CO')
  })
})

describe('runtime presentation boundary', () => {
  it('does not expose trusted internal rendering entrypoints', () => {
    expect(Object.keys(htmlRenderer).sort()).toEqual(['renderHTML', 'toHTML'])
  })

  it('rejects hostile token values before HTML attribute rendering', () => {
    const hostile = invoice({
      from: { name: 'FICTIONAL SAMPLE SILVER QUILL CO' },
      style: {
        blocks: {
          from: {
            span: 'half" onmouseover="alert(1)',
          },
        },
      },
    } as unknown as Partial<InvoMLDocument>)
    const result = renderHTML(hostile)
    expect(result.output).not.toContain('onmouseover')
    expect(result.output).not.toContain('alert(1)')
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      path: 'style.blocks.from.span',
      code: 'BLOCK_TOKEN_REJECTED',
    }))
  })

  it('rejects runtime raw style properties instead of interpolating them', () => {
    const hostile = invoice({
      style: {
        properties: {
          color: 'red; background: url(javascript:alert(1))',
        },
      },
    } as unknown as Partial<InvoMLDocument>)
    const result = renderHTML(hostile)
    expect(result.output).not.toContain('javascript:alert(1)')
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      path: 'style.properties',
      code: 'STYLE_FIELD_REJECTED',
    }))
  })

  it('rejects unknown hidden sections and does not report them as applied', () => {
    const doc = invoice({
      style: { hidden: ['section:nope'] },
    })
    const result = renderHTML(doc)
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      path: 'style.hidden.0',
      code: 'HIDDEN_REFERENCE_REJECTED',
    }))
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({
      code: 'HIDDEN_ELEMENT_APPLIED',
      message: expect.stringContaining('section:nope'),
    }))
  })

  it('diagnoses duplicate runtime order entries and renders the first once', () => {
    const doc = invoice({
      style: {
        order: ['header', 'header', 'items', 'totals'],
      },
    } as unknown as Partial<InvoMLDocument>)
    const result = renderHTML(doc)
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      path: 'style.order.1',
      code: 'ORDER_DUPLICATE_REJECTED',
    }))
    expect(result.output.match(/<header class="invoml-header"/g)).toHaveLength(1)
  })
})

describe('localized payment advice', () => {
  it.each(SUPPORTED_INVOICE_LOCALES)(
    'uses all payment-advice labels for %s',
    locale => {
      const labels = resolveInvoiceLocale(locale).labels.paymentAdvice
      const doc = invoice({
        meta: {
          documentType: 'invoice',
          number: 'INV-I18N',
          issueDate: '2026-07-30',
          dueDate: '2026-08-30',
          currency: 'USD',
          locale,
        },
        paymentAdvice: {},
      })
      const html = toHTML(doc)
      const markdown = toMarkdown(doc)
      for (const label of Object.values(labels)) {
        expect(html).toContain(label)
        expect(markdown).toContain(label)
      }
    },
  )

  it('falls back to English payment-advice labels for unknown locales', () => {
    const doc = invoice({
      meta: {
        documentType: 'invoice',
        number: 'INV-I18N',
        issueDate: '2026-07-30',
        dueDate: '2026-08-30',
        currency: 'USD',
        locale: 'xx-ZZ',
      },
      paymentAdvice: {},
    })
    expect(toHTML(doc)).toContain('Payment Advice')
    expect(toMarkdown(doc)).toContain('**Amount enclosed:**')
  })
})
