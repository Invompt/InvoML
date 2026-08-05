import { describe, expect, it } from 'vitest'
import {
  COLUMN_NAMES,
  DEFAULT_ORDER,
  META_FIELD_NAMES,
  RESERVED_BLOCK_NAMES,
  TEMPLATE_NAMES,
  resolveHidden,
  resolveOrder,
  resolveStyle,
  validateStyle,
} from '../src/style.js'
import { DATE_FORMAT_PRESETS } from '../src/date.js'
import type { InvoMLDocument, InvoMLStyle } from '../src/types.js'

function makeDoc(overrides: Partial<InvoMLDocument> = {}): InvoMLDocument {
  return {
    $invoml: '1.0',
    meta: { documentType: 'invoice', number: 'INV-001', issueDate: '2026-01-01', currency: 'USD' },
    items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    ...overrides,
  }
}

describe('typed style contract', () => {
  it('exposes the exact built-in templates and blocks', () => {
    expect(TEMPLATE_NAMES).toEqual(['standard', 'minimal', 'professional'])
    expect(RESERVED_BLOCK_NAMES).toEqual([
      'header', 'from', 'to', 'items', 'totals', 'payment', 'notes', 'paymentAdvice',
    ])
    expect(DEFAULT_ORDER).toEqual([
      'header', 'from', 'to', 'items', 'totals', 'payment', 'notes', 'paymentAdvice',
    ])
  })

  it('accepts every finite block token', () => {
    expect(validateStyle({
      template: 'professional',
      blocks: {
        header: {
          span: 'full',
          align: 'center',
          breakBefore: 'page',
          breakAfter: 'page',
          keepTogether: true,
        },
        from: { span: 'half', align: 'start' },
        to: { span: 'one-third', align: 'end' },
        'section:terms': { span: 'two-thirds' },
      },
    })).toEqual({ valid: true, errors: [], warnings: [] })
  })

  it.each([
    [{ template: 'custom' }, 'style.template'],
    [{ blocks: { header: { color: 'red' } } }, 'color'],
    [{ blocks: { unknown: { span: 'full' } } }, 'unknown'],
    [{ blocks: { header: { span: 'quarter' } } }, 'span'],
    [{ blocks: { header: { align: 'left' } } }, 'align'],
    [{ blocks: { header: { breakBefore: 'always' } } }, 'breakBefore'],
    [{ blocks: { header: { keepTogether: 'yes' } } }, 'keepTogether'],
    [{ order: ['header', 'unknown'] }, 'unknown'],
    [{ order: ['items', 'items'] }, 'duplicate'],
  ])('rejects invalid style %o', (value, expected) => {
    const result = validateStyle(value as unknown as InvoMLStyle)
    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain(expected)
  })

  it('resolves default and explicit order deterministically', () => {
    expect(resolveOrder(makeDoc())).toEqual(DEFAULT_ORDER)
    expect(resolveOrder(makeDoc({
      sections: {
        zebra: { title: 'Z', content: 'Z' },
        alpha: { title: 'A', content: 'A' },
      },
    }))).toEqual([
      'header', 'from', 'to', 'items', 'totals',
      'section:alpha', 'section:zebra', 'payment', 'notes', 'paymentAdvice',
    ])
    expect(resolveOrder(makeDoc({
      style: { order: ['header', 'items', 'items', 'paymentAdvice'] },
    }))).toEqual(['header', 'items', 'paymentAdvice'])
  })

  it('resolves template, date format, blocks, order, and hidden values', () => {
    const resolved = resolveStyle(makeDoc({
      style: {
        template: 'minimal',
        dateFormat: 'long',
        order: ['to', 'header'],
        blocks: { to: { span: 'half' } },
        hidden: ['currency', 'items'],
      },
    }))
    expect(resolved.template).toBe('minimal')
    expect(resolved.dateFormat).toBe('long')
    expect(resolved.order).toEqual(['to', 'header'])
    expect(resolved.blocks).toEqual({ to: { span: 'half' } })
    expect(resolved.hidden.meta.has('currency')).toBe(true)
    expect(resolved.hidden.blocks.has('items')).toBe(true)
  })
})

describe('hidden resolution', () => {
  it('categorises bare, prefixed, and section references', () => {
    const hidden = resolveHidden([
      'tax', 'block:paymentAdvice', 'meta:dueDate', 'section:terms',
    ])
    expect([...hidden.columns]).toEqual(['tax'])
    expect([...hidden.blocks]).toEqual(['paymentAdvice', 'section:terms'])
    expect([...hidden.meta]).toEqual(['dueDate'])
  })

  it('drops unknown references for rendering so diagnostics can report them', () => {
    const hidden = resolveHidden(['wat'])
    expect(hidden.columns.size + hidden.blocks.size + hidden.meta.size).toBe(0)
  })
})

describe('presentation vocabulary regression matrix', () => {
  it.each(TEMPLATE_NAMES)('accepts the %s template', template => {
    expect(validateStyle({ template })).toEqual({ valid: true, errors: [], warnings: [] })
    expect(resolveStyle(makeDoc({ style: { template } })).template).toBe(template)
  })

  it.each(DATE_FORMAT_PRESETS)('accepts the %s date format', dateFormat => {
    expect(validateStyle({ dateFormat })).toEqual({ valid: true, errors: [], warnings: [] })
    expect(resolveStyle(makeDoc({ style: { dateFormat } })).dateFormat).toBe(dateFormat)
  })

  it.each(['full', 'half', 'one-third', 'two-thirds'] as const)(
    'accepts block span %s',
    span => {
      expect(validateStyle({ blocks: { header: { span } } }).valid).toBe(true)
      expect(resolveStyle(makeDoc({ style: { blocks: { header: { span } } } })).blocks.header?.span)
        .toBe(span)
    },
  )

  it.each(['start', 'center', 'end'] as const)('accepts block alignment %s', align => {
    expect(validateStyle({ blocks: { header: { align } } }).valid).toBe(true)
  })

  it.each(RESERVED_BLOCK_NAMES)('accepts tokens for built-in block %s', block => {
    expect(validateStyle({
      blocks: { [block]: { span: 'full', keepTogether: true } },
    }).valid).toBe(true)
  })

  it.each(COLUMN_NAMES)('resolves bare hidden column %s', column => {
    const hidden = resolveHidden([column])
    expect(hidden.columns.has(column)).toBe(true)
    expect(validateStyle({ hidden: [column] }).warnings).toEqual([])
  })

  it.each(COLUMN_NAMES)('resolves prefixed hidden column %s', column => {
    const hidden = resolveHidden([`column:${column}`])
    expect(hidden.columns.has(column)).toBe(true)
    expect(validateStyle({ hidden: [`column:${column}`] }).warnings).toEqual([])
  })

  it.each(RESERVED_BLOCK_NAMES)('resolves bare hidden block %s', block => {
    const hidden = resolveHidden([block])
    expect(hidden.blocks.has(block)).toBe(true)
    expect(validateStyle({ hidden: [block] }).warnings).toEqual([])
  })

  it.each(RESERVED_BLOCK_NAMES)('resolves prefixed hidden block %s', block => {
    const hidden = resolveHidden([`block:${block}`])
    expect(hidden.blocks.has(block)).toBe(true)
    expect(validateStyle({ hidden: [`block:${block}`] }).warnings).toEqual([])
  })

  it.each(META_FIELD_NAMES)('resolves bare hidden metadata field %s', field => {
    const hidden = resolveHidden([field])
    expect(hidden.meta.has(field)).toBe(true)
    expect(validateStyle({ hidden: [field] }).warnings).toEqual([])
  })

  it.each(META_FIELD_NAMES)('resolves prefixed hidden metadata field %s', field => {
    const hidden = resolveHidden([`meta:${field}`])
    expect(hidden.meta.has(field)).toBe(true)
    expect(validateStyle({ hidden: [`meta:${field}`] }).warnings).toEqual([])
  })

  it.each([
    '',
    'column:nope',
    'block:nope',
    'meta:nope',
    'section:',
    'unknown',
  ])('warns for invalid hidden reference %j', hidden => {
    expect(validateStyle({ hidden: [hidden] }).warnings).toHaveLength(1)
  })

  it.each([
    ['section:terms', ['terms'], true],
    ['section:appendix', ['terms'], false],
    ['section:valid-key', ['valid-key'], true],
    ['section:valid_key', ['valid_key'], true],
    ['section:bad.key', ['bad.key'], false],
  ] as const)('validates authored order reference %s', (block, sections, valid) => {
    expect(validateStyle({
      order: [block],
    } as InvoMLStyle, [...sections]).valid).toBe(valid)
  })
})
