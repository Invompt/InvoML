// src/render-shared.ts — Shared constants and helpers consumed by both serializer.ts and html-renderer.ts.
// Keeps field lists, label text, and business logic in one place so the two renderers cannot drift.

import type { InvoMLItem, InvoMLPayment, InvoMLStructuredParty, InvoMLTotals } from './types.js'
import type { InvoiceLabels } from './locale.js'

// ─── Party fields ────────────────────────────────────────────────────────────

/** Ordered detail fields for an InvoMLParty (everything after `name`, which each renderer handles separately). */
type PartyDetailKey = Exclude<keyof InvoMLStructuredParty, 'content' | 'name' | 'address' | 'countryCode'>

export const PARTY_DETAIL_FIELDS: ReadonlyArray<{ key: PartyDetailKey; prefix: string }> = [
  { key: 'attention',      prefix: 'Attn: ' },
  { key: 'email',          prefix: '' },
  { key: 'phone',          prefix: '' },
  { key: 'website',        prefix: '' },
  { key: 'taxId',          prefix: 'Tax ID: ' },
  { key: 'businessNumber', prefix: 'Business No: ' },
]

// ─── Payment fields ──────────────────────────────────────────────────────────

/** Ordered structured fields for InvoMLPayment (excludes `title`, `content`, and `method` which are handled separately). */
export const PAYMENT_FIELDS: ReadonlyArray<{ key: keyof InvoMLPayment; label: string }> = [
  { key: 'beneficiary',   label: 'Beneficiary' },
  { key: 'bank',          label: 'Bank' },
  { key: 'iban',          label: 'IBAN' },
  { key: 'swift',         label: 'SWIFT/BIC' },
  { key: 'routingNumber', label: 'Routing' },
  { key: 'accountNumber', label: 'Account' },
  { key: 'cryptoAddress', label: 'Address' },
  { key: 'cryptoNetwork', label: 'Network' },
]

// ─── Item column detection ───────────────────────────────────────────────────

/** Detect which optional columns are present in the items array.
 *  A column is hidden when it is in the `hidden` set OR the data isn't present. */
export function detectItemColumns(items: InvoMLItem[], hidden?: Set<string>): {
  hasUnit: boolean
  hasDiscount: boolean
  hasTax: boolean
} {
  return {
    hasUnit:     !hidden?.has('unit')     && items.some(i => i.unit),
    hasDiscount: !hidden?.has('discount') && items.some(i => i.discount),
    hasTax:      !hidden?.has('tax')      && items.some(i => i.taxAmount !== undefined),
  }
}

// ─── Totals row descriptors ──────────────────────────────────────────────────

/** Discriminant for totals row emphasis — each renderer maps these to its own styling rules. */
export type TotalsRowKind = 'subtotal' | 'detail' | 'grand' | 'prepaid' | 'amount-due'

/** A format-agnostic totals row descriptor. */
export interface TotalsRow {
  label: string
  formattedAmount: string
  kind: TotalsRowKind
}

/**
 * Build the ordered list of totals row descriptors from computed totals.
 * Both renderers consume this sequence and apply their own formatting/markup.
 */
export function buildTotalsRows(
  totals: InvoMLTotals,
  currency: string,
  fmt: (n: number) => string,
  labels?: InvoiceLabels['totals'],
): TotalsRow[] {
  const rows: TotalsRow[] = []
  const text = labels ?? {
    summary: 'Invoice summary',
    subtotal: 'Subtotal',
    discount: 'Discount',
    afterDiscounts: 'After Discounts',
    included: 'included',
    withholding: 'Withholding',
    total: 'Total',
    prepaid: 'Prepaid',
    amountDue: 'Amount Due',
  }

  rows.push({ label: text.subtotal, formattedAmount: fmt(totals.subtotal), kind: 'subtotal' })

  if (totals.discountDetails) {
    for (const d of totals.discountDetails) {
      rows.push({ label: d.label ?? text.discount, formattedAmount: `-${fmt(d.amount)}`, kind: 'detail' })
    }
    rows.push({ label: text.afterDiscounts, formattedAmount: fmt(totals.afterDiscounts), kind: 'detail' })
  }

  if (totals.taxDetails) {
    for (const t of totals.taxDetails) {
      const suffix = t.inclusive ? ` (${text.included})` : ''
      rows.push({ label: `${t.label ?? t.category}${suffix}`, formattedAmount: fmt(t.amount), kind: 'detail' })
    }
  }

  if (totals.withholdingTotal && totals.withholdingTotal > 0) {
    rows.push({ label: text.withholding, formattedAmount: `-${fmt(totals.withholdingTotal)}`, kind: 'detail' })
  }

  rows.push({ label: `${text.total} (${currency})`, formattedAmount: fmt(totals.total), kind: 'grand' })

  if (totals.prepaidAmount && totals.prepaidAmount > 0) {
    rows.push({ label: text.prepaid, formattedAmount: `-${fmt(totals.prepaidAmount)}`, kind: 'prepaid' })
    rows.push({ label: text.amountDue, formattedAmount: fmt(totals.amountDue), kind: 'amount-due' })
  }

  return rows
}
