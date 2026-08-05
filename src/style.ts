// src/style.ts

import type {
  InvoMLBlockStyle,
  InvoMLBlockName,
  InvoMLDocument,
  InvoMLStyle,
  InvoMLDateFormat,
  InvoMLTemplate,
  BaseValidationResult,
} from './types.js'
import { DATE_FORMAT_PRESETS } from './date.js'
import { resolveInvoiceLocale } from './locale.js'

/** Prefix used for custom section block names in `style.order` and `style.blocks`. */
export const SECTION_PREFIX = 'section:'

/** All recognised item column names for `style.hidden` resolution. */
export const COLUMN_NAMES: ReadonlyArray<string> = ['tax', 'unit', 'discount', 'quantity', 'unitPrice', 'description', 'amount']

/** All recognised header meta field names for `style.hidden` resolution. */
export const META_FIELD_NAMES: ReadonlyArray<string> = ['dueDate', 'expiryDate', 'currency', 'reference', 'creditNoteReference']

/** Categorised result of parsing `style.hidden`. */
export interface ResolvedHidden {
  columns: Set<string>
  blocks: Set<string>
  meta: Set<string>
}

/** Extract the section key from a block name like `'section:terms'`, or return `null` if the block is not a section. */
export function parseSectionKey(block: string): string | null {
  return block.startsWith(SECTION_PREFIX) ? block.slice(SECTION_PREFIX.length) : null
}

/** The fixed set of built-in block names that may appear in `style.order` and `style.blocks`. */
export const RESERVED_BLOCK_NAMES = ['header', 'from', 'to', 'items', 'totals', 'payment', 'notes', 'paymentAdvice'] as const

/** Default rendering order applied when no `style.order` is specified. Custom sections are inserted after `totals`. */
export const DEFAULT_ORDER: InvoMLBlockName[] = ['header', 'from', 'to', 'items', 'totals', 'payment', 'notes', 'paymentAdvice']

/** Canonical built-in presentation templates. */
export const TEMPLATE_NAMES = ['standard', 'minimal', 'professional'] as const satisfies ReadonlyArray<InvoMLTemplate>

/** Result of `validateStyle` — structural/token errors plus advisory hidden-reference warnings. */
export interface StyleValidationResult extends BaseValidationResult {
  errors: string[]
  warnings: string[]
}

/** Resolve the effective block rendering order for a document.
 *  If style.order is present, deduplicate it and return the result.
 *  Otherwise build the canonical default order, inserting custom sections (sorted alphabetically)
 *  after totals and before payment. */
export function resolveOrder(doc: InvoMLDocument): InvoMLBlockName[] {
  if (doc.style?.order) {
    // Deduplicate: each block name renders at most once (first occurrence wins)
    const seen = new Set<string>()
    return doc.style.order.filter(b => {
      if (seen.has(b)) return false
      seen.add(b)
      return true
    })
  }

  const sectionNames = doc.sections ? Object.keys(doc.sections).sort() : []
  if (sectionNames.length === 0) return DEFAULT_ORDER

  const result: InvoMLBlockName[] = []
  for (const block of DEFAULT_ORDER) {
    result.push(block)
    if (block === 'totals') {
      for (const name of sectionNames) {
        result.push(`${SECTION_PREFIX}${name}`)
      }
    }
  }
  return result
}

/** Parse a `style.hidden` array into categorised sets.
 *  Entries are trimmed before resolution. Unrecognised entries are dropped here —
 *  call `validateStyle` to surface them as warnings. */
export function resolveHidden(hidden?: string[]): ResolvedHidden {
  const columns = new Set<string>()
  const blocks = new Set<string>()
  const meta = new Set<string>()

  if (!hidden) return { columns, blocks, meta }

  for (const raw of hidden) {
    const entry = raw.trim()
    if (entry === '') continue

    if (entry.startsWith('column:')) {
      const tail = entry.slice('column:'.length)
      if (tail !== '' && (COLUMN_NAMES as ReadonlyArray<string>).includes(tail)) columns.add(tail)
    } else if (entry.startsWith('block:')) {
      const tail = entry.slice('block:'.length)
      if (tail !== '' && (RESERVED_BLOCK_NAMES as ReadonlyArray<string>).includes(tail)) blocks.add(tail)
    } else if (entry.startsWith('meta:')) {
      const tail = entry.slice('meta:'.length)
      if (tail !== '' && (META_FIELD_NAMES as ReadonlyArray<string>).includes(tail)) meta.add(tail)
    } else if (entry.startsWith(SECTION_PREFIX)) {
      // section:key is a block reference; presence is validated by validateStyle
      if (entry.length > SECTION_PREFIX.length) blocks.add(entry)
    } else if ((COLUMN_NAMES as ReadonlyArray<string>).includes(entry)) {
      columns.add(entry)
    } else if ((RESERVED_BLOCK_NAMES as ReadonlyArray<string>).includes(entry)) {
      blocks.add(entry)
    } else if ((META_FIELD_NAMES as ReadonlyArray<string>).includes(entry)) {
      meta.add(entry)
    }
    // Unrecognised entries are dropped silently (warning emitted by validateStyle)
  }

  return { columns, blocks, meta }
}

/** Resolve the effective page footer from document style and locale defaults. */
export function resolvePageFooter(doc: InvoMLDocument): { show: boolean; format: string } {
  const locale = resolveInvoiceLocale(doc.meta.locale)
  const defaultFormat = locale.labels.pagination.format
  const authored = doc.style?.pageFooter

  if (authored?.show === false) {
    return { show: false, format: defaultFormat }
  }
  if (authored?.format !== undefined) {
    return { show: true, format: authored.format }
  }
  return { show: true, format: defaultFormat }
}

/** Validate a style object against the normative style rules. */
export function validateStyle(style: InvoMLStyle, sectionNames?: string[]): StyleValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (
    style.template !== undefined
    && !(TEMPLATE_NAMES as ReadonlyArray<string>).includes(style.template)
  ) {
    errors.push(`style.template must be one of: ${TEMPLATE_NAMES.join(', ')}`)
  }

  if (
    style.dateFormat !== undefined
    && !(DATE_FORMAT_PRESETS as ReadonlyArray<string>).includes(style.dateFormat)
  ) {
    errors.push(`style.dateFormat must be one of: ${DATE_FORMAT_PRESETS.join(', ')}`)
  }

  if (style.order !== undefined) {
    if (style.order.length === 0) {
      errors.push('style.order must contain at least one entry')
    } else {
      const seen = new Set<string>()
      for (const entry of style.order) {
        if (seen.has(entry)) {
          errors.push(`style.order contains duplicate entry "${entry}"`)
        }
        seen.add(entry)
        const sectionKey = parseSectionKey(entry)
        if (sectionKey !== null) {
          if (!/^[a-zA-Z0-9_-]+$/.test(sectionKey)) {
            errors.push(`style.order entry "${entry}" must use section:<key> with an alphanumeric, hyphen, or underscore key`)
          } else if (sectionNames !== undefined && !sectionNames.includes(sectionKey)) {
            errors.push(`style.order references unknown section "${sectionKey}"`)
          }
        } else if (!(RESERVED_BLOCK_NAMES as readonly string[]).includes(entry)) {
          errors.push(`style.order entry "${entry}" is not a reserved block name or section:<key> reference`)
        }
      }
    }
  }

  if (style.blocks) {
    for (const [key, tokens] of Object.entries(style.blocks)) {
      const isReserved = (RESERVED_BLOCK_NAMES as readonly string[]).includes(key)
      const isSectionPattern = key.startsWith(SECTION_PREFIX) && /^[a-zA-Z0-9_-]+$/.test(key.slice(SECTION_PREFIX.length))
      if (!isReserved && !isSectionPattern) {
        errors.push(`style.blocks key "${key}" is not a reserved block name or section:<key> pattern`)
      } else if (
        isSectionPattern
        && sectionNames !== undefined
        && !sectionNames.includes(key.slice(SECTION_PREFIX.length))
      ) {
        errors.push(`style.blocks references unknown section "${key.slice(SECTION_PREFIX.length)}"`)
      }
      if (!tokens || typeof tokens !== 'object') {
        errors.push(`style.blocks.${key} must be an object`)
        continue
      }
      const allowedKeys = new Set(['span', 'align', 'breakBefore', 'breakAfter', 'keepTogether'])
      for (const token of Object.keys(tokens)) {
        if (!allowedKeys.has(token)) {
          errors.push(`style.blocks.${key}.${token} is not a recognised presentation token`)
        }
      }
      if (tokens.span !== undefined && !['full', 'half', 'one-third', 'two-thirds'].includes(tokens.span)) {
        errors.push(`style.blocks.${key}.span must be one of: full, half, one-third, two-thirds`)
      }
      if (tokens.align !== undefined && !['start', 'center', 'end'].includes(tokens.align)) {
        errors.push(`style.blocks.${key}.align must be one of: start, center, end`)
      }
      if (tokens.breakBefore !== undefined && tokens.breakBefore !== 'page') {
        errors.push(`style.blocks.${key}.breakBefore must be "page"`)
      }
      if (tokens.breakAfter !== undefined && tokens.breakAfter !== 'page') {
        errors.push(`style.blocks.${key}.breakAfter must be "page"`)
      }
      if (tokens.keepTogether !== undefined && typeof tokens.keepTogether !== 'boolean') {
        errors.push(`style.blocks.${key}.keepTogether must be a boolean`)
      }
    }
  }

  if (style.pageFooter !== undefined) {
    if (!style.pageFooter || typeof style.pageFooter !== 'object') {
      errors.push('style.pageFooter must be an object')
    } else {
      const allowedKeys = new Set(['show', 'format'])
      for (const key of Object.keys(style.pageFooter)) {
        if (!allowedKeys.has(key)) {
          errors.push(`style.pageFooter.${key} is not a recognised property`)
        }
      }
      if (style.pageFooter.show !== undefined && typeof style.pageFooter.show !== 'boolean') {
        errors.push('style.pageFooter.show must be a boolean')
      }
      if (style.pageFooter.format !== undefined) {
        if (typeof style.pageFooter.format !== 'string') {
          errors.push('style.pageFooter.format must be a string')
        } else if (style.pageFooter.format.length > 120) {
          errors.push('style.pageFooter.format must not exceed 120 characters')
        } else if (!style.pageFooter.format.includes('{page}')) {
          errors.push('style.pageFooter.format must contain the {page} placeholder')
        } else {
          const placeholderPattern = /\{[a-zA-Z]+\}/g
          const placeholders = style.pageFooter.format.match(placeholderPattern) ?? []
          const invalid = placeholders.filter(p => p !== '{page}' && p !== '{pages}')
          if (invalid.length > 0) {
            errors.push(`style.pageFooter.format contains invalid placeholder(s): ${invalid.join(', ')}`)
          }
        }
      }
    }
  }

  if (style.hidden) {
    for (const raw of style.hidden) {
      const entry = raw.trim()
      if (entry === '') {
        warnings.push(`style.hidden contains an empty entry`)
        continue
      }

      if (entry.startsWith('column:')) {
        const tail = entry.slice('column:'.length)
        if (tail === '') {
          warnings.push(`style.hidden entry "${raw}" has an empty column name`)
        } else if (!(COLUMN_NAMES as ReadonlyArray<string>).includes(tail)) {
          warnings.push(`style.hidden entry "${raw}" references unknown column "${tail}"`)
        }
      } else if (entry.startsWith('block:')) {
        const tail = entry.slice('block:'.length)
        if (tail === '') {
          warnings.push(`style.hidden entry "${raw}" has an empty block name`)
        } else if (!(RESERVED_BLOCK_NAMES as ReadonlyArray<string>).includes(tail)) {
          warnings.push(`style.hidden entry "${raw}" references unknown block "${tail}". Custom sections must use the section: prefix.`)
        }
      } else if (entry.startsWith('meta:')) {
        const tail = entry.slice('meta:'.length)
        if (tail === '') {
          warnings.push(`style.hidden entry "${raw}" has an empty meta field name`)
        } else if (!(META_FIELD_NAMES as ReadonlyArray<string>).includes(tail)) {
          warnings.push(`style.hidden entry "${raw}" references unknown meta field "${tail}"`)
        }
      } else if (entry.startsWith(SECTION_PREFIX)) {
        const key = entry.slice(SECTION_PREFIX.length)
        if (key === '') {
          warnings.push(`style.hidden entry "${raw}" has an empty section key`)
        } else if (sectionNames !== undefined && !sectionNames.includes(key)) {
          warnings.push(`style.hidden references unknown section "${key}"`)
        }
      } else {
        const isKnownBare =
          (COLUMN_NAMES as ReadonlyArray<string>).includes(entry) ||
          (RESERVED_BLOCK_NAMES as ReadonlyArray<string>).includes(entry) ||
          (META_FIELD_NAMES as ReadonlyArray<string>).includes(entry)
        if (!isKnownBare) {
          const hint = suggestHiddenName(entry)
          warnings.push(
            `style.hidden entry "${raw}" is not a recognised name. Expected a bare column/block/meta name or a column:/block:/meta:/section: prefix.${hint ? ` Did you mean "${hint}"?` : ''}`
          )
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings }
}

/** Suggest a recognised hidden name for a typo (case-insensitive match). Returns null when no match. */
function suggestHiddenName(entry: string): string | null {
  const lower = entry.toLowerCase()
  const all: ReadonlyArray<string> = [
    ...COLUMN_NAMES,
    ...RESERVED_BLOCK_NAMES,
    ...META_FIELD_NAMES,
  ]
  for (const name of all) {
    if (name.toLowerCase() === lower) return name
  }
  return null
}

/** Resolve the full style object with defaults applied. */
export function resolveStyle(doc: InvoMLDocument): {
  order: InvoMLBlockName[]
  dateFormat: InvoMLDateFormat
  template: InvoMLTemplate
  blocks: Partial<Record<InvoMLBlockName, InvoMLBlockStyle>>
  hidden: ResolvedHidden
} {
  return {
    order: resolveOrder(doc),
    dateFormat: doc.style?.dateFormat ?? 'iso',
    template: doc.style?.template ?? 'standard',
    blocks: doc.style?.blocks ?? {},
    hidden: resolveHidden(doc.style?.hidden),
  }
}
