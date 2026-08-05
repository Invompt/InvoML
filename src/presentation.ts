import { calculate } from './calculator.js'
import { prepareDocumentForOutput } from './document-preparation.js'
import { renderHTMLDocumentInternal } from './html-output.js'
import { renderMarkdownDocumentInternal } from './markdown-output.js'
import type { RenderOptions } from './render-options.js'
import {
  COLUMN_NAMES,
  META_FIELD_NAMES,
  RESERVED_BLOCK_NAMES,
  SECTION_PREFIX,
  TEMPLATE_NAMES,
  parseSectionKey,
  resolveStyle,
} from './style.js'
import { DATE_FORMAT_PRESETS } from './date.js'
import { resolveInvoiceLocale, type InvoiceLabels } from './locale.js'
import type {
  InvoMLBlockStyle,
  InvoMLBlockName,
  InvoMLDocument,
  InvoMLStyle,
  InvoMLParty,
  InvoMLTemplate,
} from './types.js'
import type { ResolvedPaymentAdvice } from './presentation-internal.js'

export type PresentationTarget = 'html' | 'markdown'
export type PresentationStatus = 'applied' | 'fallback' | 'skipped' | 'rejected'
export type PresentationSupport = 'full' | 'partial' | 'none'

export interface PresentationDiagnostic {
  path: string
  code: string
  status: PresentationStatus
  support: PresentationSupport
  message: string
}

export interface PresentationResult {
  output: string
  diagnostics: PresentationDiagnostic[]
}

function diagnostic(
  path: string,
  code: string,
  status: PresentationStatus,
  support: PresentationSupport,
  message: string,
): PresentationDiagnostic {
  return { path, code, status, support, message }
}

function sortDiagnostics(diagnostics: PresentationDiagnostic[]): PresentationDiagnostic[] {
  const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
  return diagnostics.sort((a, b) =>
    compare(a.path, b.path)
    || compare(a.code, b.code)
    || compare(a.status, b.status)
    || compare(a.message, b.message)
  )
}

const BUILT_IN_BLOCKS = new Set<string>(RESERVED_BLOCK_NAMES)
const BLOCK_SPANS = new Set(['full', 'half', 'one-third', 'two-thirds'])
const BLOCK_ALIGNS = new Set(['start', 'center', 'end'])
const BLOCK_TOKEN_NAMES = new Set(['span', 'align', 'breakBefore', 'breakAfter', 'keepTogether'])
const SECTION_KEY_RE = /^[a-zA-Z0-9_-]+$/

function isBlockName(value: unknown): value is InvoMLBlockName {
  if (typeof value !== 'string') return false
  if (BUILT_IN_BLOCKS.has(value)) return true
  return value.startsWith(SECTION_PREFIX) && SECTION_KEY_RE.test(value.slice(SECTION_PREFIX.length))
}

function normalizeBlockTokens(
  block: InvoMLBlockName,
  value: unknown,
  diagnostics: PresentationDiagnostic[],
): InvoMLBlockStyle | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    diagnostics.push(diagnostic(
      `style.blocks.${block}`,
      'BLOCK_TOKENS_REJECTED',
      'rejected',
      'none',
      `Presentation tokens for "${block}" must be an object.`,
    ))
    return undefined
  }

  const tokens: InvoMLBlockStyle = {}
  for (const [name, tokenValue] of Object.entries(value)) {
    const path = `style.blocks.${block}.${name}`
    let accepted = true
    if (!BLOCK_TOKEN_NAMES.has(name)) {
      accepted = false
    } else if (name === 'span') {
      accepted = typeof tokenValue === 'string' && BLOCK_SPANS.has(tokenValue)
      if (accepted) tokens.span = tokenValue as InvoMLBlockStyle['span']
    } else if (name === 'align') {
      accepted = typeof tokenValue === 'string' && BLOCK_ALIGNS.has(tokenValue)
      if (accepted) tokens.align = tokenValue as InvoMLBlockStyle['align']
    } else if (name === 'breakBefore') {
      accepted = tokenValue === 'page'
      if (accepted) tokens.breakBefore = 'page'
    } else if (name === 'breakAfter') {
      accepted = tokenValue === 'page'
      if (accepted) tokens.breakAfter = 'page'
    } else if (name === 'keepTogether') {
      accepted = typeof tokenValue === 'boolean'
      if (accepted) tokens.keepTogether = tokenValue
    }

    if (!accepted) {
      diagnostics.push(diagnostic(
        path,
        'BLOCK_TOKEN_REJECTED',
        'rejected',
        'none',
        `Invalid presentation token ${name}=${String(tokenValue)} was not applied.`,
      ))
    }
  }
  return tokens
}

function normalizeHiddenReference(value: unknown, doc: InvoMLDocument): string | null {
  if (typeof value !== 'string') return null
  const entry = value.trim()
  if (!entry) return null

  if (entry.startsWith(SECTION_PREFIX)) {
    const key = entry.slice(SECTION_PREFIX.length)
    return SECTION_KEY_RE.test(key) && doc.sections?.[key] !== undefined ? entry : null
  }
  if (entry.startsWith('column:')) {
    return (COLUMN_NAMES as ReadonlyArray<string>).includes(entry.slice('column:'.length)) ? entry : null
  }
  if (entry.startsWith('meta:')) {
    return (META_FIELD_NAMES as ReadonlyArray<string>).includes(entry.slice('meta:'.length)) ? entry : null
  }
  if (entry.startsWith('block:')) {
    return BUILT_IN_BLOCKS.has(entry.slice('block:'.length)) ? entry : null
  }
  return (COLUMN_NAMES as ReadonlyArray<string>).includes(entry)
    || (META_FIELD_NAMES as ReadonlyArray<string>).includes(entry)
    || BUILT_IN_BLOCKS.has(entry)
    ? entry
    : null
}

function normalizePresentationDocument(
  doc: InvoMLDocument,
  diagnostics: PresentationDiagnostic[],
): InvoMLDocument {
  const normalized = structuredClone(doc)
  const rawStyle = (doc as { style?: unknown }).style
  if (rawStyle === undefined) return normalized
  if (!rawStyle || typeof rawStyle !== 'object' || Array.isArray(rawStyle)) {
    diagnostics.push(diagnostic(
      'style',
      'STYLE_REJECTED',
      'rejected',
      'none',
      'Style must be an object; the canonical default presentation was applied.',
    ))
    delete normalized.style
    return normalized
  }

  const raw = rawStyle as Record<string, unknown>
  const style: InvoMLStyle = {}
  const allowedStyleFields = new Set(['template', 'dateFormat', 'order', 'blocks', 'hidden', 'pageFooter'])
  for (const field of Object.keys(raw)) {
    if (!allowedStyleFields.has(field)) {
      diagnostics.push(diagnostic(
        `style.${field}`,
        'STYLE_FIELD_REJECTED',
        'rejected',
        'none',
        `Unknown style field "${field}" was not applied.`,
      ))
    }
  }

  if (raw.template !== undefined) {
    if (typeof raw.template === 'string' && (TEMPLATE_NAMES as readonly string[]).includes(raw.template)) {
      style.template = raw.template as InvoMLTemplate
    } else {
      diagnostics.push(diagnostic(
        'style.template',
        'TEMPLATE_REJECTED',
        'rejected',
        'none',
        `Unknown template "${String(raw.template)}"; the standard template was applied.`,
      ))
    }
  }

  if (raw.dateFormat !== undefined) {
    if (typeof raw.dateFormat === 'string' && (DATE_FORMAT_PRESETS as readonly string[]).includes(raw.dateFormat)) {
      style.dateFormat = raw.dateFormat as InvoMLStyle['dateFormat']
    } else {
      diagnostics.push(diagnostic(
        'style.dateFormat',
        'DATE_FORMAT_REJECTED',
        'rejected',
        'none',
        `Invalid date format "${String(raw.dateFormat)}"; ISO formatting was applied.`,
      ))
    }
  }

  if (raw.order !== undefined) {
    if (!Array.isArray(raw.order)) {
      diagnostics.push(diagnostic(
        'style.order',
        'ORDER_REJECTED',
        'rejected',
        'none',
        'Block order must be an array; the canonical default order was applied.',
      ))
    } else {
      if (raw.order.length === 0) {
        diagnostics.push(diagnostic(
          'style.order',
          'ORDER_REJECTED',
          'rejected',
          'none',
          'Block order must contain at least one entry; the canonical default order was applied.',
        ))
      }
      const order: InvoMLBlockName[] = []
      const seen = new Set<InvoMLBlockName>()
      raw.order.forEach((entry, index) => {
        if (!isBlockName(entry)) {
          diagnostics.push(diagnostic(
            `style.order.${index}`,
            'ORDER_ENTRY_REJECTED',
            'rejected',
            'none',
            `Invalid block reference "${String(entry)}" was not applied.`,
          ))
          return
        }
        if (seen.has(entry)) {
          diagnostics.push(diagnostic(
            `style.order.${index}`,
            'ORDER_DUPLICATE_REJECTED',
            'rejected',
            'none',
            `Duplicate block reference "${entry}" was ignored; the first occurrence wins.`,
          ))
          return
        }
        seen.add(entry)
        order.push(entry)
      })
      if (order.length > 0) style.order = order
    }
  }

  if (raw.blocks !== undefined) {
    if (!raw.blocks || typeof raw.blocks !== 'object' || Array.isArray(raw.blocks)) {
      diagnostics.push(diagnostic(
        'style.blocks',
        'BLOCKS_REJECTED',
        'rejected',
        'none',
        'Block presentation must be an object and was not applied.',
      ))
    } else {
      const blocks: Partial<Record<InvoMLBlockName, InvoMLBlockStyle>> = {}
      for (const [block, rawTokens] of Object.entries(raw.blocks)) {
        if (!isBlockName(block)) {
          diagnostics.push(diagnostic(
            `style.blocks.${block}`,
            'BLOCK_REFERENCE_REJECTED',
            'rejected',
            'none',
            `Invalid presentation block reference "${block}" was not applied.`,
          ))
          continue
        }
        const tokens = normalizeBlockTokens(block, rawTokens, diagnostics)
        if (tokens) blocks[block] = tokens
      }
      if (Object.keys(blocks).length > 0) style.blocks = blocks
    }
  }

  if (raw.hidden !== undefined) {
    if (!Array.isArray(raw.hidden)) {
      diagnostics.push(diagnostic(
        'style.hidden',
        'HIDDEN_REJECTED',
        'rejected',
        'none',
        'Hidden references must be an array and were not applied.',
      ))
    } else {
      const hidden: string[] = []
      const seen = new Set<string>()
      raw.hidden.forEach((entry, index) => {
        const accepted = normalizeHiddenReference(entry, doc)
        if (!accepted) {
          diagnostics.push(diagnostic(
            `style.hidden.${index}`,
            'HIDDEN_REFERENCE_REJECTED',
            'rejected',
            'none',
            `Unknown hidden reference "${String(entry)}" was not applied.`,
          ))
          return
        }
        if (seen.has(accepted)) {
          diagnostics.push(diagnostic(
            `style.hidden.${index}`,
            'HIDDEN_DUPLICATE_REJECTED',
            'rejected',
            'none',
            `Duplicate hidden reference "${accepted}" was ignored.`,
          ))
          return
        }
        seen.add(accepted)
        hidden.push(accepted)
      })
      if (hidden.length > 0) style.hidden = hidden
    }
  }

  if (raw.pageFooter !== undefined) {
    if (!raw.pageFooter || typeof raw.pageFooter !== 'object' || Array.isArray(raw.pageFooter)) {
      diagnostics.push(diagnostic(
        'style.pageFooter',
        'PAGE_FOOTER_REJECTED',
        'rejected',
        'none',
        'pageFooter must be an object and was not applied.',
      ))
    } else {
      const pageFooter = raw.pageFooter as Record<string, unknown>
      const normalizedPageFooter: { show?: boolean; format?: string } = {}
      let valid = true

      if (pageFooter.show !== undefined) {
        if (typeof pageFooter.show === 'boolean') {
          normalizedPageFooter.show = pageFooter.show
        } else {
          diagnostics.push(diagnostic(
            'style.pageFooter.show',
            'PAGE_FOOTER_SHOW_REJECTED',
            'rejected',
            'none',
            `pageFooter.show must be a boolean; got ${String(pageFooter.show)}.`,
          ))
          valid = false
        }
      }

      if (pageFooter.format !== undefined) {
        if (typeof pageFooter.format !== 'string') {
          diagnostics.push(diagnostic(
            'style.pageFooter.format',
            'PAGE_FOOTER_FORMAT_REJECTED',
            'rejected',
            'none',
            `pageFooter.format must be a string; got ${String(pageFooter.format)}.`,
          ))
          valid = false
        } else if (pageFooter.format.length > 120) {
          diagnostics.push(diagnostic(
            'style.pageFooter.format',
            'PAGE_FOOTER_FORMAT_REJECTED',
            'rejected',
            'none',
            'pageFooter.format exceeds the maximum length of 120 characters.',
          ))
          valid = false
        } else if (!pageFooter.format.includes('{page}')) {
          diagnostics.push(diagnostic(
            'style.pageFooter.format',
            'PAGE_FOOTER_FORMAT_REJECTED',
            'rejected',
            'none',
            'pageFooter.format must contain the {page} placeholder.',
          ))
          valid = false
        } else {
          const placeholderPattern = /\{[a-zA-Z]+\}/g
          const placeholders = pageFooter.format.match(placeholderPattern) ?? []
          const invalid = placeholders.filter(p => p !== '{page}' && p !== '{pages}')
          if (invalid.length > 0) {
            diagnostics.push(diagnostic(
              'style.pageFooter.format',
              'PAGE_FOOTER_FORMAT_REJECTED',
              'rejected',
              'none',
              `pageFooter.format contains invalid placeholder(s): ${invalid.join(', ')}.`,
            ))
            valid = false
          } else {
            normalizedPageFooter.format = pageFooter.format
          }
        }
      }

      if (valid && (normalizedPageFooter.show !== undefined || normalizedPageFooter.format !== undefined)) {
        style.pageFooter = normalizedPageFooter
      }
    }
  }

  normalized.style = style
  return normalized
}

function partyDisplayName(party: InvoMLParty | undefined): string {
  if (!party) return ''
  if (party.content !== undefined) {
    for (const line of party.content.split(/\r?\n/)) {
      const visible = line
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]*>/g, '')
        .replace(/[*_~`#>]/g, '')
        .trim()
      if (visible) return visible
    }
    return ''
  }
  return party.name
    ?? party.attention
    ?? party.email
    ?? party.address?.lines.find(line => line.trim() !== '')
    ?? ''
}

function hasBlockData(
  block: string,
  doc: InvoMLDocument,
  paymentAdvice: ResolvedPaymentAdvice | undefined,
): boolean {
  switch (block) {
    case 'header': return true
    case 'from': return doc.from !== undefined
    case 'to': return doc.to !== undefined
    case 'items': return doc.items.length > 0
    case 'totals': return doc.totals !== undefined
    case 'payment': return doc.payment !== undefined
    case 'paymentAdvice': return paymentAdvice !== undefined
    case 'notes': return Boolean(doc.notes)
    default: {
      const sectionKey = parseSectionKey(block)
      return sectionKey !== null && doc.sections?.[sectionKey] !== undefined
    }
  }
}

function availableBlocks(doc: InvoMLDocument): InvoMLBlockName[] {
  const blocks: InvoMLBlockName[] = ['header']
  if (doc.from) blocks.push('from')
  if (doc.to) blocks.push('to')
  if (doc.items.length > 0) blocks.push('items')
  if (doc.totals) blocks.push('totals')
  if (doc.payment) blocks.push('payment')
  if (doc.paymentAdvice) blocks.push('paymentAdvice')
  if (doc.notes) blocks.push('notes')
  for (const key of Object.keys(doc.sections ?? {}).sort()) blocks.push(`${SECTION_PREFIX}${key}`)
  return blocks
}

function addBlockTokenDiagnostics(
  diagnostics: PresentationDiagnostic[],
  target: PresentationTarget,
  block: string,
  tokens: InvoMLBlockStyle,
): void {
  const entries = Object.entries(tokens).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
  for (const [token, value] of entries) {
    const path = `style.blocks.${block}.${token}`
    if (target === 'html') {
      diagnostics.push(diagnostic(
        path,
        'BLOCK_TOKEN_APPLIED',
        'applied',
        'full',
        `Applied ${token}=${String(value)} to HTML block "${block}".`,
      ))
    } else {
      diagnostics.push(diagnostic(
        path,
        'BLOCK_TOKEN_TARGET_FALLBACK',
        'fallback',
        'none',
        `Markdown preserves block order and content but cannot represent ${token}=${String(value)}.`,
      ))
    }
  }
}

function resolvePaymentAdvice(
  doc: InvoMLDocument,
  diagnostics: PresentationDiagnostic[],
  labels: InvoiceLabels,
): ResolvedPaymentAdvice | undefined {
  if (!doc.paymentAdvice) return undefined

  if (doc.meta.documentType !== 'invoice') {
    diagnostics.push(diagnostic(
      'paymentAdvice',
      'PAYMENT_ADVICE_INVOICE_ONLY',
      'rejected',
      'none',
      `Payment advice is only supported for invoices, not ${doc.meta.documentType}.`,
    ))
    return undefined
  }

  let amountDue: number
  try {
    amountDue = calculate(doc).amountDue
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    diagnostics.push(diagnostic(
      'paymentAdvice.amountDue',
      'PAYMENT_ADVICE_CALCULATION_FAILED',
      'skipped',
      'none',
      `Payment advice was skipped because amount due could not be calculated: ${message}`,
    ))
    return undefined
  }

  if (!Number.isFinite(amountDue)) {
    diagnostics.push(diagnostic(
      'paymentAdvice.amountDue',
      'PAYMENT_ADVICE_INVALID_AMOUNT_DUE',
      'rejected',
      'none',
      'Payment advice cannot render a non-finite amount due.',
    ))
    return undefined
  }

  if (amountDue < 0) {
    diagnostics.push(diagnostic(
      'paymentAdvice.amountDue',
      'PAYMENT_ADVICE_NEGATIVE_AMOUNT_DUE',
      'rejected',
      'none',
      `Payment advice cannot render a negative amount due (${amountDue}).`,
    ))
    return undefined
  }

  const customer = partyDisplayName(doc.to)
  if (!customer) {
    diagnostics.push(diagnostic(
      'paymentAdvice.customer',
      'PAYMENT_ADVICE_CUSTOMER_MISSING',
      'fallback',
      'partial',
      'No customer name could be derived from the document recipient; the customer field is blank.',
    ))
  }
  if (!doc.meta.dueDate) {
    diagnostics.push(diagnostic(
      'paymentAdvice.dueDate',
      'PAYMENT_ADVICE_DUE_DATE_MISSING',
      'skipped',
      'partial',
      'No due date is authored, so the optional due-date field is omitted.',
    ))
  }

  diagnostics.push(diagnostic(
    'paymentAdvice.amountDue',
    'PAYMENT_ADVICE_AMOUNT_DUE_COMPUTED',
    'applied',
    'full',
    'Amount due was recalculated from authored invoice data; cached totals and item-derived values were ignored.',
  ))

  return {
    title: doc.paymentAdvice.title ?? labels.paymentAdvice.title,
    content: doc.paymentAdvice.content,
    number: doc.meta.number,
    dueDate: doc.meta.dueDate,
    customer,
    amountDue,
  }
}

/**
 * Resolve presentation intent once, render the selected target, and return every
 * applied, skipped, rejected, or fallback decision as deterministic diagnostics.
 */
export function resolvePresentation(
  doc: InvoMLDocument,
  target: PresentationTarget,
  options?: RenderOptions,
): PresentationResult {
  if (target !== 'html' && target !== 'markdown') {
    throw new TypeError(`Unsupported presentation target "${String(target)}". Expected "html" or "markdown".`)
  }

  const diagnostics: PresentationDiagnostic[] = []
  const normalizedDoc = normalizePresentationDocument(doc, diagnostics)
  const intentStyle = resolveStyle(normalizedDoc)
  const adviceOrdered = intentStyle.order.includes('paymentAdvice')
  const adviceHidden = intentStyle.hidden.blocks.has('paymentAdvice')
  const adviceEligible = normalizedDoc.paymentAdvice !== undefined && adviceOrdered && !adviceHidden
  let renderDoc: InvoMLDocument

  try {
    renderDoc = prepareDocumentForOutput(normalizedDoc)
  } catch (error) {
    if (!adviceEligible) throw error
    renderDoc = structuredClone(normalizedDoc)
    const message = error instanceof Error ? error.message : String(error)
    diagnostics.push(diagnostic(
      'items',
      'PRESENTATION_CALCULATION_FALLBACK',
      'fallback',
      'partial',
      `Computed item hydration failed; authored values are rendered and payment advice is skipped: ${message}`,
    ))
  }

  const style = resolveStyle(renderDoc)
  if (target === 'html') {
    diagnostics.push(diagnostic(
      'style.template',
      'TEMPLATE_APPLIED',
      'applied',
      'full',
      `Applied the ${style.template} HTML template.`,
    ))
  } else {
    diagnostics.push(diagnostic(
      'style.template',
      'TEMPLATE_TARGET_FALLBACK',
      'fallback',
      'none',
      `Markdown cannot represent the ${style.template} visual template; semantic content is preserved.`,
    ))
  }

  diagnostics.push(diagnostic(
    'style.order',
    renderDoc.style?.order ? 'ORDER_APPLIED' : 'ORDER_DEFAULTED',
    renderDoc.style?.order ? 'applied' : 'fallback',
    'full',
    renderDoc.style?.order
      ? 'Applied the authored block order.'
      : 'Applied the canonical default block order.',
  ))

  const locale = resolveInvoiceLocale(renderDoc.meta.locale)
  const paymentAdvice = adviceEligible
    ? resolvePaymentAdvice(renderDoc, diagnostics, locale.labels)
    : undefined
  const paymentAdviceTerminal = adviceEligible && renderDoc.paymentAdvice !== undefined && paymentAdvice === undefined

  for (const block of style.order) {
    const blockPath = block.startsWith(SECTION_PREFIX)
      ? `sections.${block.slice(SECTION_PREFIX.length)}`
      : block
    if (style.hidden.blocks.has(block)) {
      diagnostics.push(diagnostic(
        blockPath,
        'BLOCK_HIDDEN',
        'skipped',
        'full',
        `Block "${block}" was explicitly hidden.`,
      ))
      if (Object.keys(style.blocks[block] ?? {}).length > 0) {
        diagnostics.push(diagnostic(
          `style.blocks.${block}`,
          'BLOCK_TOKENS_HIDDEN',
          'skipped',
          'none',
          `Presentation tokens for "${block}" were not applied because the block is hidden.`,
        ))
      }
      continue
    }

    if (block === 'paymentAdvice' && paymentAdviceTerminal) {
      continue
    }

    if (!hasBlockData(block, renderDoc, paymentAdvice)) {
      diagnostics.push(diagnostic(
        blockPath,
        'BLOCK_DATA_MISSING',
        'skipped',
        'none',
        `Block "${block}" has no renderable data.`,
      ))
      continue
    }

    diagnostics.push(diagnostic(
      blockPath,
      'BLOCK_RENDERED',
      'applied',
      'full',
      `Rendered block "${block}" for ${target}.`,
    ))
    addBlockTokenDiagnostics(diagnostics, target, block, style.blocks[block] ?? {})
  }

  if (renderDoc.style?.order) {
    const ordered = new Set(style.order)
    for (const block of availableBlocks(renderDoc)) {
      if (!ordered.has(block)) {
        diagnostics.push(diagnostic(
          'style.order',
          'BLOCK_OMITTED_BY_ORDER',
          'skipped',
          'full',
          `Block "${block}" contains data but is omitted from the explicit order.`,
        ))
      }
    }
  }

  const blockEntries = Object.entries(style.blocks) as Array<[InvoMLBlockName, InvoMLBlockStyle]>
  for (const [block, tokens] of blockEntries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (!style.order.includes(block)) {
      diagnostics.push(diagnostic(
        `style.blocks.${block}`,
        'BLOCK_TOKENS_NOT_ORDERED',
        'skipped',
        'none',
        `Presentation tokens for "${block}" are not applied because the block is absent from style.order.`,
      ))
    }
  }

  for (const hidden of renderDoc.style?.hidden ?? []) {
    const value = hidden.trim()
    if (!style.hidden.blocks.has(value)) {
      diagnostics.push(diagnostic(
        'style.hidden',
        'HIDDEN_ELEMENT_APPLIED',
        'applied',
        'full',
        `Applied hidden reference "${hidden}".`,
      ))
    }
  }

  const output = target === 'html'
    ? renderHTMLDocumentInternal(renderDoc, options, paymentAdvice)
    : renderMarkdownDocumentInternal(renderDoc, paymentAdvice)

  return { output, diagnostics: sortDiagnostics(diagnostics) }
}
