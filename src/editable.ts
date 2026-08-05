// src/editable.ts — Editable field metadata and DOM attribute helpers.

import { escapeHtml } from './markdown.js'

const esc = escapeHtml

// ─── Editable field labels ────────────────────────────────────────────────────

export const EDITABLE_FIELD_LABELS: Record<string, string> = {
  'meta.documentType': 'Document type',
  'meta.number': 'Invoice number',
  'meta.issueDate': 'Issue date',
  'meta.dueDate': 'Due date',
  'meta.expiryDate': 'Expiry date',
  'meta.currency': 'Currency',
  'meta.reference': 'Reference',
  'meta.creditNoteReference': 'Credit note reference',
  'from.content': 'Sender details',
  'from.name': 'Sender name',
  'from.attention': 'Sender attention',
  'from.email': 'Sender email',
  'from.phone': 'Sender phone',
  'from.website': 'Sender website',
  'from.taxId': 'Sender tax ID',
  'from.businessNumber': 'Sender business number',
  'to.content': 'Recipient details',
  'to.name': 'Recipient name',
  'to.attention': 'Recipient attention',
  'to.email': 'Recipient email',
  'to.phone': 'Recipient phone',
  'to.website': 'Recipient website',
  'to.taxId': 'Recipient tax ID',
  'to.businessNumber': 'Recipient business number',
  'payment.title': 'Payment title',
  'payment.content': 'Payment details',
  'paymentAdvice.title': 'Payment advice title',
  'paymentAdvice.content': 'Payment advice details',
  'notes': 'Notes',
}

function getFieldLabel(field: string): string {
  if (field in EDITABLE_FIELD_LABELS) return EDITABLE_FIELD_LABELS[field]
  // Handle indexed item fields: items.0.description → "Item 1 description"
  const itemMatch = field.match(/^items\.(\d+)\.(\w+)$/)
  if (itemMatch) {
    const idx = parseInt(itemMatch[1], 10) + 1
    const prop = itemMatch[2]
    return `Item ${idx} ${prop}`
  }
  const addressMatch = field.match(/^(from|to)\.address\.lines\.(\d+)$/)
  if (addressMatch) {
    const role = addressMatch[1] === 'from' ? 'Sender' : 'Recipient'
    return `${role} address line ${parseInt(addressMatch[2], 10) + 1}`
  }
  // Handle section fields: sections.terms.content → "Section terms content"
  const sectionMatch = field.match(/^sections\.(.+)\.content$/)
  if (sectionMatch) return `Section ${sectionMatch[1]} content`
  return field
}

/**
 * Checks if an item-level field is computed (not user-editable).
 * NOTE: Totals-block fields are marked computed via `data-invoml-computed`
 * attributes directly in the HTML, not through this function.
 * This function only covers item-level computed fields.
 */
export function isComputedField(field: string): boolean {
  if (field.startsWith('items.') && (field.endsWith('.amount') || field.endsWith('.taxAmount'))) return true
  return false
}

/**
 * Post-processes rendered HTML to add contenteditable and aria-label attributes
 * to all editable fields. Computed fields get contenteditable="false".
 */
export function applyEditable(html: string): string {
  return html.replace(
    /data-invoml-field="([^"]+)"/g,
    (_match, field: string) => {
      const computed = isComputedField(field)
      const label = getFieldLabel(field)
      const ce = computed ? 'contenteditable="false"' : 'contenteditable="true"'
      return `data-invoml-field="${field}" ${ce} aria-label="${esc(label)}"`
    }
  ).replace(
    /data-invoml-computed>/g,
    (match, offset, str) => {
      // Skip if this element already has contenteditable (added by the first pass for field elements)
      const tagStart = str.lastIndexOf('<', offset)
      if (str.slice(tagStart, offset).includes('contenteditable')) return match
      return 'data-invoml-computed contenteditable="false">'
    }
  )
}
