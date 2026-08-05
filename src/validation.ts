// src/validation.ts

import type { InvoMLDocument, BaseValidationResult } from './types.js'
import { calculate } from './calculator.js'
import { resolveTaxConfig } from './tax.js'

/** A single domain-level validation finding with a severity level and JSON-path location. */
export interface ValidationIssue {
  level: 'error' | 'warning'
  path: string
  code: string
  message: string
}

/** Result of `validate` — a validity flag plus the full list of issues found. */
export interface DomainValidationResult extends BaseValidationResult {
  issues: ValidationIssue[]
}

// ISO 4217 active currency codes
// IMPORTANT: Keep in sync with ZERO_DECIMAL and THREE_DECIMAL sets in rounding.ts.
// Any currency in those sets must also appear here.
const VALID_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SEK',
  'MXN', 'SGD', 'HKD', 'NOK', 'KRW', 'TRY', 'INR', 'RUB', 'BRL', 'ZAR',
  'DKK', 'PLN', 'TWD', 'THB', 'MYR', 'IDR', 'HUF', 'CZK', 'ILS', 'CLP',
  'PHP', 'AED', 'COP', 'SAR', 'RON', 'VND', 'UAH', 'ARS', 'PEN', 'EGP',
  'NGN', 'BDT', 'PKR', 'KZT', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'ISK',
  'GEL', 'UYI', 'UYU', 'DOP', 'GTQ', 'CRC', 'PYG', 'BOB', 'HNL', 'NIO', 'PAB',
  'SVC', 'TTD', 'JMD', 'BBD', 'BZD', 'GYD', 'SRD', 'HTG', 'AWG', 'ANG',
  'XCD', 'BSD', 'BMD', 'KYD', 'FJD', 'TOP', 'WST', 'VUV', 'PGK', 'SBD',
  'SCR', 'MVR', 'MUR', 'LKR', 'NPR', 'BTN', 'MMK', 'KHR', 'LAK', 'MNT',
  'KGS', 'TJS', 'UZS', 'TMT', 'AFN', 'IRR', 'IQD', 'SYP', 'LBP', 'YER',
  'MAD', 'DZD', 'TND', 'LYD', 'SDG', 'SSP', 'ETB', 'KES', 'UGX', 'TZS',
  'RWF', 'BIF', 'MGA', 'MWK', 'ZMW', 'ZWL', 'BWP', 'LSL', 'SZL', 'NAD',
  'MZN', 'AOA', 'STN', 'CVE', 'XAF', 'XOF', 'XPF', 'GHS', 'GMD', 'GNF',
  'SLL', 'LRD', 'DJF', 'ERN', 'SOS', 'CDF', 'KMF', 'MRU', 'ALL', 'MKD',
  'BAM', 'RSD', 'BGN', 'MDL', 'GIP', 'FKP', 'SHP', 'XDR', 'XAG', 'XAU',
  'XPT', 'XPD',
])

const LARGE_TOTAL_THRESHOLD = 10_000_000
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
type DateField = 'issueDate' | 'dueDate' | 'expiryDate'

function addIssue(
  issues: ValidationIssue[],
  level: ValidationIssue['level'],
  path: string,
  code: string,
  message: string,
): void {
  issues.push({ level, path, code, message })
}

function parseISODateStrict(value: string): Date | null {
  const match = ISO_DATE_RE.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }

  return date
}

function addInvalidDateIssue(issues: ValidationIssue[], field: DateField, value: string): void {
  addIssue(
    issues,
    'error',
    `meta.${field}`,
    'INVALID_DATE_FORMAT',
    `${field} must be a valid ISO 8601 date (YYYY-MM-DD). Got "${value}".`,
  )
}

function validateDocumentNumber(doc: InvoMLDocument, issues: ValidationIssue[]): void {
  if (!doc.meta.number || doc.meta.number.trim() === '') {
    addIssue(issues, 'error', 'meta.number', 'EMPTY_NUMBER', 'Document number must not be empty.')
  }
}

function validateCurrency(doc: InvoMLDocument, issues: ValidationIssue[]): void {
  if (!VALID_CURRENCIES.has(doc.meta.currency)) {
    addIssue(
      issues,
      'error',
      'meta.currency',
      'INVALID_CURRENCY',
      `"${doc.meta.currency}" is not a recognised ISO 4217 currency code.`,
    )
  }
}

function validateItems(doc: InvoMLDocument, issues: ValidationIssue[]): void {
  if (!doc.items || doc.items.length === 0) {
    addIssue(issues, 'error', 'items', 'EMPTY_ITEMS', 'The items array must contain at least one item.')
    return
  }

  for (let i = 0; i < doc.items.length; i++) {
    const item = doc.items[i]

    if (!Number.isFinite(item.quantity)) {
      addIssue(
        issues,
        'error',
        `items[${i}].quantity`,
        'INVALID_ITEM_VALUE',
        `Item at index ${i} has a non-finite quantity: ${item.quantity}.`,
      )
    } else if (item.quantity <= 0) {
      addIssue(
        issues,
        'error',
        `items[${i}].quantity`,
        'NON_POSITIVE_QUANTITY',
        `Item at index ${i} has a quantity of ${item.quantity}; must be greater than 0.`,
      )
    }

    if (!Number.isFinite(item.unitPrice)) {
      addIssue(
        issues,
        'error',
        `items[${i}].unitPrice`,
        'INVALID_ITEM_VALUE',
        `Item at index ${i} has a non-finite unit price: ${item.unitPrice}.`,
      )
    } else if (item.unitPrice < 0) {
      addIssue(
        issues,
        'error',
        `items[${i}].unitPrice`,
        'NEGATIVE_UNIT_PRICE',
        `Item at index ${i} has a negative unit price of ${item.unitPrice}.`,
      )
    }
  }
}

function parseMetaDates(
  doc: InvoMLDocument,
  issues: ValidationIssue[],
): Record<DateField, Date | null> {
  const parsedIssueDate = parseISODateStrict(doc.meta.issueDate)
  if (!parsedIssueDate) {
    addInvalidDateIssue(issues, 'issueDate', doc.meta.issueDate)
  }

  const optionalFields: DateField[] = ['dueDate', 'expiryDate']
  const parsedDates: Record<DateField, Date | null> = {
    issueDate: parsedIssueDate,
    dueDate: null,
    expiryDate: null,
  }

  for (const field of optionalFields) {
    const value = doc.meta[field]
    if (!value) continue

    const parsedValue = parseISODateStrict(value)
    if (!parsedValue) {
      addInvalidDateIssue(issues, field, value)
      continue
    }

    parsedDates[field] = parsedValue
  }

  return parsedDates
}

function validateTaxConfig(doc: InvoMLDocument, issues: ValidationIssue[]): void {
  const resolvedTax = resolveTaxConfig(doc.meta.tax)
  if (!resolvedTax) return

  const categoryIds = new Set(resolvedTax.categories.map(category => category.id))
  const itemsWithoutExplicitCategory = doc.items.filter(item => !item.taxCategory).length
  const defaultCategories = resolvedTax.categories.filter(category => category.default)

  for (let i = 0; i < doc.items.length; i++) {
    const taxCategory = doc.items[i].taxCategory
    if (taxCategory && !categoryIds.has(taxCategory)) {
      addIssue(
        issues,
        'error',
        `items[${i}].taxCategory`,
        'UNKNOWN_CATEGORY',
        `Item at index ${i} references unknown tax category "${taxCategory}".`,
      )
    }
  }

  if (itemsWithoutExplicitCategory === 0) return

  if (defaultCategories.length === 0) {
    addIssue(
      issues,
      'error',
      'meta.tax.categories',
      'NO_DEFAULT_CATEGORY',
      'At least one tax category must be marked as default when items omit taxCategory.',
    )
  } else if (defaultCategories.length > 1) {
    addIssue(
      issues,
      'error',
      'meta.tax.categories',
      'MULTIPLE_DEFAULT_CATEGORIES',
      `Tax config has ${defaultCategories.length} default categories — exactly one is allowed when items omit taxCategory.`,
    )
  }
}

function addWarningRules(
  doc: InvoMLDocument,
  issues: ValidationIssue[],
  parsedDates: Record<DateField, Date | null>,
): void {
  const { issueDate, dueDate } = parsedDates

  if (issueDate && dueDate && dueDate.getTime() < issueDate.getTime()) {
    addIssue(
      issues,
      'warning',
      'meta.dueDate',
      'DUE_BEFORE_ISSUE',
      `Due date (${doc.meta.dueDate}) is before issue date (${doc.meta.issueDate}).`,
    )
  }

  if (issueDate) {
    const diff = issueDate.getTime() - Date.now()

    if (diff < -ONE_YEAR_MS) {
      addIssue(
        issues,
        'warning',
        'meta.issueDate',
        'ISSUE_DATE_TOO_OLD',
        `Issue date (${doc.meta.issueDate}) is more than 1 year in the past.`,
      )
    } else if (diff > ONE_YEAR_MS) {
      addIssue(
        issues,
        'warning',
        'meta.issueDate',
        'ISSUE_DATE_FUTURE',
        `Issue date (${doc.meta.issueDate}) is more than 1 year in the future.`,
      )
    }
  }

  const seenDescriptions = new Map<string, number>()
  for (let i = 0; i < doc.items.length; i++) {
    const key = doc.items[i].description.toLowerCase()
    if (seenDescriptions.has(key)) {
      addIssue(
        issues,
        'warning',
        `items[${i}].description`,
        'DUPLICATE_DESCRIPTION',
        `Item description "${doc.items[i].description}" is a duplicate of item at index ${seenDescriptions.get(key)}.`,
      )
    } else {
      seenDescriptions.set(key, i)
    }
  }
}

function addLargeTotalWarning(doc: InvoMLDocument, issues: ValidationIssue[]): void {
  try {
    const totals = calculate(doc)
    if (totals.total > LARGE_TOTAL_THRESHOLD) {
      addIssue(
        issues,
        'warning',
        'items',
        'LARGE_TOTAL',
        `Calculated total (${totals.total}) exceeds ${'10,000,000'}.`,
      )
    }
  } catch (error) {
    addIssue(
      issues,
      'error',
      'totals',
      'CALCULATION_FAILED',
      `Could not verify totals: ${error instanceof Error ? error.message : 'unknown error'}`,
    )
  }
}

function validatePaymentAdvice(doc: InvoMLDocument, issues: ValidationIssue[]): void {
  if (!doc.paymentAdvice) return
  if (doc.meta.documentType !== 'invoice') {
    addIssue(
      issues,
      'error',
      'paymentAdvice',
      'PAYMENT_ADVICE_INVOICE_ONLY',
      `Payment advice is only valid for invoices, not ${doc.meta.documentType}.`,
    )
    return
  }

  try {
    const amountDue = calculate(doc).amountDue
    if (!Number.isFinite(amountDue)) {
      addIssue(
        issues,
        'error',
        'paymentAdvice',
        'PAYMENT_ADVICE_INVALID_AMOUNT_DUE',
        'Payment advice cannot represent a non-finite amount due.',
      )
    } else if (amountDue < 0) {
      addIssue(
        issues,
        'error',
        'paymentAdvice',
        'PAYMENT_ADVICE_NEGATIVE_AMOUNT_DUE',
        `Payment advice cannot represent a negative amount due (${amountDue}).`,
      )
    }
  } catch (error) {
    addIssue(
      issues,
      'error',
      'paymentAdvice',
      'PAYMENT_ADVICE_CALCULATION_FAILED',
      `Payment advice amount due could not be calculated: ${error instanceof Error ? error.message : 'unknown error'}`,
    )
  }
}

/**
 * Run domain-level validation on an already-parsed `InvoMLDocument`.
 *
 * This is distinct from `validateSchema` (JSON Schema structural check).
 * `validate` checks business rules: currency codes, date ordering, duplicate
 * item descriptions, negative prices, and computed total sanity.
 *
 * Returns `{ valid: true, issues: [] }` when no errors are found.
 * Warnings do not affect the `valid` flag — only `error`-level issues do.
 */
export function validate(doc: InvoMLDocument): DomainValidationResult {
  const issues: ValidationIssue[] = []

  validateDocumentNumber(doc, issues)
  validateCurrency(doc, issues)
  validateItems(doc, issues)
  const parsedDates = parseMetaDates(doc, issues)
  validateTaxConfig(doc, issues)
  addWarningRules(doc, issues, parsedDates)
  validatePaymentAdvice(doc, issues)

  // Calculated total exceeds threshold — only run when no error-level blockers were found.
  const hasErrors = issues.some(issue => issue.level === 'error')
  if (!hasErrors) {
    addLargeTotalWarning(doc, issues)
  }

  const valid = !issues.some(iss => iss.level === 'error')
  return { valid, issues }
}
