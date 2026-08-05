/** Locale-aware number formatter — deterministic, no Intl.NumberFormat. */

import { getCurrencyDecimals } from './rounding.js'

export interface NumberFormatOptions {
  thousandsSep: string
  decimalSep: string
  grouping: 'standard' | 'indian'
}

const FORMAT_EN: NumberFormatOptions   = { thousandsSep: ',',       decimalSep: '.', grouping: 'standard' }
const FORMAT_DE: NumberFormatOptions   = { thousandsSep: '.',       decimalSep: ',', grouping: 'standard' }
const FORMAT_CH: NumberFormatOptions   = { thousandsSep: "'",       decimalSep: '.', grouping: 'standard' }
const FORMAT_IN: NumberFormatOptions   = { thousandsSep: ',',       decimalSep: '.', grouping: 'indian'   }
const FORMAT_SPACE: NumberFormatOptions = { thousandsSep: '\u202F', decimalSep: ',', grouping: 'standard' }

// Exact-match overrides (checked before prefix matching)
const EXACT: Record<string, NumberFormatOptions> = {
  'de-ch': FORMAT_CH,
  'fr-ch': FORMAT_CH,
  'it-ch': FORMAT_CH,
  'fr-fr': FORMAT_SPACE,
  'en-in': FORMAT_IN,
  'hi-in': FORMAT_IN,
}

// Prefix-to-format table (checked in order)
const PREFIX_MAP: Array<[string, NumberFormatOptions]> = [
  ['en', FORMAT_EN],
  ['ja', FORMAT_EN],
  ['ko', FORMAT_EN],
  ['zh', FORMAT_EN],
  ['ms', FORMAT_EN],
  ['th', FORMAT_EN],
  ['de', FORMAT_DE],
  ['es', FORMAT_DE],
  ['pt', FORMAT_DE],
  ['it', FORMAT_DE],
  ['nl', FORMAT_DE],
  ['tr', FORMAT_DE],
  ['ru', FORMAT_DE],
  ['el', FORMAT_DE],
  ['ro', FORMAT_DE],
  ['uk', FORMAT_DE],
  ['vi', FORMAT_DE],
  ['id', FORMAT_DE],
  ['hr', FORMAT_DE],
  ['sk', FORMAT_DE],
  ['sl', FORMAT_DE],
  ['bg', FORMAT_DE],
  ['hi', FORMAT_IN],
  ['mr', FORMAT_IN],
  ['bn', FORMAT_IN],
  ['ta', FORMAT_IN],
  ['te', FORMAT_IN],
  ['kn', FORMAT_IN],
  ['gu', FORMAT_IN],
  ['ml', FORMAT_IN],
  ['pa', FORMAT_IN],
  ['fr', FORMAT_SPACE],
  ['sv', FORMAT_SPACE],
  ['nb', FORMAT_SPACE],
  ['nn', FORMAT_SPACE],
  ['fi', FORMAT_SPACE],
  ['pl', FORMAT_SPACE],
  ['cs', FORMAT_SPACE],
  ['da', FORMAT_SPACE],
  ['et', FORMAT_SPACE],
  ['lv', FORMAT_SPACE],
  ['lt', FORMAT_SPACE],
]

/**
 * Resolves a NumberFormatOptions for the given locale tag.
 * Falls back to English (en) formatting if the locale is not recognized.
 * Supports exact matches (e.g., "pt-BR") and prefix matches (e.g., "pt" → "pt-BR").
 *
 * Supported locale prefixes and their grouping style:
 * - `en`, `ja`, `ko`, `zh`, `ms`, `th` → US-style (comma thousands, dot decimal)
 * - `de`, `es`, `pt`, `it`, `nl`, `tr`, `ru`, `el`, `ro`, `uk`, `vi`, `id`, `hr`, `sk`, `sl`, `bg` → DE-style (dot thousands, comma decimal)
 * - `hi`, `mr`, `bn`, `ta`, `te`, `kn`, `gu`, `ml`, `pa` → Indian grouping (2-2-3, comma thousands)
 * - `fr`, `sv`, `nb`, `nn`, `fi`, `pl`, `cs`, `da`, `et`, `lv`, `lt` → narrow-space thousands, comma decimal
 *
 * Exact-match overrides take priority: `de-CH`, `fr-CH`, `it-CH` → Swiss apostrophe;
 * `fr-FR` → narrow-space; `en-IN`, `hi-IN` → Indian grouping.
 */
export function resolveNumberFormat(locale?: string): NumberFormatOptions {
  if (!locale) return FORMAT_EN
  const lower = locale.toLowerCase()
  // Exact match first (handles Swiss + fr-FR overrides)
  if (Object.prototype.hasOwnProperty.call(EXACT, lower)) return EXACT[lower]
  // Prefix match
  for (const [prefix, fmt] of PREFIX_MAP) {
    if (lower === prefix || lower.startsWith(`${prefix}-`)) return fmt
  }
  return FORMAT_EN
}

function applyIndianGrouping(intStr: string, sep: string): string {
  // Sign handling
  const negative = intStr.startsWith('-')
  const digits = negative ? intStr.slice(1) : intStr
  if (digits.length <= 3) return negative ? `-${digits}` : digits
  // Rightmost group is 3, then groups of 2
  const firstGroupEnd = digits.length - 3
  const rightGroup = digits.slice(firstGroupEnd)
  const leftDigits = digits.slice(0, firstGroupEnd)
  // Split left digits into groups of 2 from the right
  const groups: string[] = []
  let i = leftDigits.length
  while (i > 0) {
    const start = Math.max(0, i - 2)
    groups.unshift(leftDigits.slice(start, i))
    i = start
  }
  groups.push(rightGroup)
  const result = groups.join(sep)
  return negative ? `-${result}` : result
}

function applyStandardGrouping(intStr: string, sep: string): string {
  // Handle negative sign explicitly
  const negative = intStr.startsWith('-')
  const digits = negative ? intStr.slice(1) : intStr

  // Group from right in chunks of 3
  let result = ''
  for (let i = digits.length; i > 0; i -= 3) {
    const start = Math.max(0, i - 3)
    result = digits.slice(start, i) + (result ? sep + result : '')
  }

  return negative ? '-' + result : result
}

/**
 * Locale-aware number formatter. Deterministic — does not use `Intl.NumberFormat`.
 *
 * @param n   The number to format. Must be finite; throws on `Infinity` / `NaN`.
 * @param dp  Decimal places to render (0 = integer, 2 = currency default, 3 = KWD/OMR/etc.).
 * @param opts Locale-specific separators from `resolveNumberFormat`. Defaults to US-style when omitted.
 *
 * @example
 * fmtNum(7200, 2)                              // "7,200.00"
 * fmtNum(7200, 2, resolveNumberFormat('de'))   // "7.200,00"
 * fmtNum(1234567, 2, resolveNumberFormat('hi'))// "12,34,567.00"
 */
export function fmtNum(n: number, dp: number, opts?: NumberFormatOptions): string {
  if (!Number.isFinite(n)) throw new Error(`Cannot format non-finite number: ${n}`)
  let fixed = n.toFixed(dp)
  // Normalize negative zero: -0.00 → 0.00
  if (parseFloat(fixed) === 0) fixed = (0).toFixed(dp)

  const fmt = opts ?? FORMAT_EN

  if (dp === 0) {
    return fmt.grouping === 'indian'
      ? applyIndianGrouping(fixed, fmt.thousandsSep)
      : applyStandardGrouping(fixed, fmt.thousandsSep)
  }

  const dotIndex = fixed.lastIndexOf('.')
  const intPart = fixed.slice(0, dotIndex)
  const fracPart = fixed.slice(dotIndex + 1)

  const formattedInt = fmt.grouping === 'indian'
    ? applyIndianGrouping(intPart, fmt.thousandsSep)
    : applyStandardGrouping(intPart, fmt.thousandsSep)

  return `${formattedInt}${fmt.decimalSep}${fracPart}`
}

/**
 * Creates a bound number formatter for a specific currency and locale.
 * Resolves decimal places from currency and number format from locale once,
 * returns a reusable formatting function.
 */
export function buildFormatter(currency?: string, locale?: string): (n: number) => string {
  const dp = getCurrencyDecimals(currency ?? '')
  const numFmt = resolveNumberFormat(locale)
  return (n: number) => fmtNum(n, dp, numFmt)
}

/**
 * Format a document type enum value (e.g. `'credit_note'`) into a display title (`'CREDIT NOTE'`).
 * Replaces underscores with spaces and uppercases the result.
 */
export function formatDocumentType(type: string): string {
  return type.replaceAll('_', ' ').toUpperCase()
}

/**
 * Format a discount value as a display string.
 * Percentage discounts render as "10%"; fixed discounts render using the provided formatter.
 * Plain string discounts are returned as-is.
 */
export function formatDiscount(
  discount: string | { type: string; value: number },
  fmt: (n: number) => string
): string {
  if (typeof discount === 'string') return discount
  if (discount.type === 'percentage') return `${discount.value}%`
  return fmt(discount.value)
}
