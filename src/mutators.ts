// src/mutators.ts
import type { InvoMLDocument, InvoMLTotals, InvoMLDiscount } from './types.js'
import { hydrateCalculatedDocument } from './calculator.js'

/** Result of any mutator function — the new (cloned) document and its freshly recalculated totals. */
export interface MutationResult {
  document: InvoMLDocument
  totals: InvoMLTotals
}

/**
 * Append an invoice-level discount to an `InvoMLDocument` and return the updated document
 * with recalculated totals. Operates on the whole document — not on a raw monetary amount.
 * Invoice-level discounts cascade: each one applies to the running subtotal after previous discounts.
 * Does NOT mutate the input — returns new object references.
 */
export function applyDiscount(
  doc: InvoMLDocument,
  discount: { type: 'percentage' | 'fixed'; value: number; label?: string },
): MutationResult {
  const newDoc = structuredClone(doc)
  const entry: InvoMLDiscount = { type: discount.type, value: discount.value }
  if (discount.label !== undefined) entry.label = discount.label
  newDoc.discounts = [...(newDoc.discounts ?? []), entry]
  const totals = hydrateCalculatedDocument(newDoc).totals!
  return { document: newDoc, totals }
}

/**
 * Remove all invoice-level discounts. Returns new doc + recalculated totals.
 * Does NOT mutate the input.
 */
export function removeDiscounts(doc: InvoMLDocument): MutationResult {
  const newDoc = structuredClone(doc)
  delete newDoc.discounts
  const totals = hydrateCalculatedDocument(newDoc).totals!
  return { document: newDoc, totals }
}

/**
 * Apply or replace the document-level tax configuration (simple form).
 * Throws if the document already has a multi-category (InvoMLTaxFull) config.
 * Does NOT mutate the input.
 */
export function applyTax(
  doc: InvoMLDocument,
  tax: { rate: number; label?: string; inclusive?: boolean },
): MutationResult {
  if (doc.meta?.tax && 'categories' in doc.meta.tax) {
    throw new Error(
      'Cannot apply simple tax to a document with a multi-category (InvoMLTaxFull) config. Use the full tax config API instead.',
    )
  }
  const newDoc = structuredClone(doc)
  newDoc.meta = {
    ...newDoc.meta,
    tax: {
      label: tax.label ?? 'Tax',
      rate: tax.rate,
      inclusive: tax.inclusive ?? false,
    },
  }
  const totals = hydrateCalculatedDocument(newDoc).totals!
  return { document: newDoc, totals }
}

/**
 * Remove document-level tax. Returns new doc + recalculated totals.
 * Does NOT mutate the input.
 */
export function removeTax(doc: InvoMLDocument): MutationResult {
  const newDoc = structuredClone(doc)
  delete newDoc.meta.tax
  const totals = hydrateCalculatedDocument(newDoc).totals!
  return { document: newDoc, totals }
}
