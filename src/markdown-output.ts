// src/serializer.ts

import type { InvoMLDocument, InvoMLParty } from './types.js'
import type { ResolvedPaymentAdvice } from './presentation-internal.js'
import { resolveStyle, parseSectionKey } from './style.js'
import type { ResolvedHidden } from './style.js'
import { buildFormatter, formatDiscount, formatDocumentType } from './format.js'
import { PARTY_DETAIL_FIELDS, PAYMENT_FIELDS, detectItemColumns, buildTotalsRows } from './render-shared.js'
import { formatDate } from './date.js'
import { resolveInvoiceLocale, type InvoiceLabels } from './locale.js'

/** Render an InvoML document as a human-readable Markdown table. Computed line fields are refreshed in a working copy before rendering; totals are refreshed only when `doc.totals` is present. */
export function renderMarkdownDocumentInternal(
  renderDoc: InvoMLDocument,
  paymentAdvice?: ResolvedPaymentAdvice,
): string {
  const lines: string[] = []
  const currency = renderDoc.meta.currency
  const fmt = buildFormatter(currency, renderDoc.meta.locale)
  const labels = resolveInvoiceLocale(renderDoc.meta.locale).labels

  const style = resolveStyle(renderDoc)
  const dateFmt = (value: string) => formatDate(value, renderDoc.meta.locale, style.dateFormat)

  for (const block of style.order) {
    if (style.hidden.blocks.has(block)) continue
    renderBlock(block, renderDoc, lines, currency, fmt, dateFmt, style.hidden, paymentAdvice, labels)
  }

  return lines.join('\n')
}

type NumFmt = (n: number) => string

function renderBlock(
  block: string,
  doc: InvoMLDocument,
  lines: string[],
  currency: string,
  fmt: NumFmt,
  dateFmt: (value: string) => string,
  hidden?: ResolvedHidden,
  paymentAdvice?: ResolvedPaymentAdvice,
  labels?: InvoiceLabels,
): void {
  if (block === 'header') {
    const type = formatDocumentType(doc.meta.documentType)
    lines.push(`# ${type} ${doc.meta.number}`)
    lines.push('')
    lines.push(`**Date:** ${dateFmt(doc.meta.issueDate)}`)
    if (doc.meta.dueDate && !hidden?.meta.has('dueDate')) lines.push(`**Due:** ${dateFmt(doc.meta.dueDate)}`)
    if (doc.meta.expiryDate && !hidden?.meta.has('expiryDate')) lines.push(`**Expires:** ${dateFmt(doc.meta.expiryDate)}`)
    if (!hidden?.meta.has('currency')) lines.push(`**Currency:** ${currency}`)
    if (doc.meta.reference && !hidden?.meta.has('reference')) lines.push(`**Reference:** ${doc.meta.reference}`)
    if (doc.meta.creditNoteReference && !hidden?.meta.has('creditNoteReference')) lines.push(`**Ref:** ${doc.meta.creditNoteReference}`)
    lines.push('')
  } else if (block === 'from') {
    renderParty('From', doc.from, lines)
  } else if (block === 'to') {
    renderParty('To', doc.to, lines)
  } else if (block === 'items') {
    renderItems(doc, lines, fmt, hidden?.columns)
  } else if (block === 'totals') {
    renderTotals(doc, lines, fmt)
  } else if (block === 'payment') {
    renderPayment(doc, lines)
  } else if (block === 'paymentAdvice') {
    renderPaymentAdvice(paymentAdvice, lines, fmt, dateFmt, labels!)
  } else if (block === 'notes') {
    if (doc.notes) {
      lines.push('---')
      lines.push('')
      lines.push(`*${doc.notes}*`)
      lines.push('')
    }
  } else {
    const sectionKey = parseSectionKey(block)
    if (sectionKey === null) return
    const section = doc.sections?.[sectionKey]
    if (section) {
      lines.push(`### ${section.title}`)
      lines.push('')
      lines.push(section.content)
      lines.push('')
    }
  }
}

function renderPaymentAdvice(
  advice: ResolvedPaymentAdvice | undefined,
  lines: string[],
  fmt: NumFmt,
  dateFmt: (value: string) => string,
  labels: InvoiceLabels,
): void {
  if (!advice) return
  lines.push(`### ${advice.title}`)
  lines.push('')
  if (advice.content) {
    lines.push(advice.content)
    lines.push('')
  }
  lines.push(`**${labels.paymentAdvice.invoiceNumber}:** ${advice.number}`)
  if (advice.dueDate) lines.push(`**${labels.paymentAdvice.dueDate}:** ${dateFmt(advice.dueDate)}`)
  lines.push(`**${labels.paymentAdvice.customer}:** ${advice.customer}`)
  lines.push(`**${labels.paymentAdvice.amountDue}:** ${fmt(advice.amountDue)}`)
  lines.push(`**${labels.paymentAdvice.amountEnclosed}:** `)
  lines.push('')
}

function renderParty(label: string, party: InvoMLParty | undefined, lines: string[]): void {
  if (!party) return
  lines.push(`**${label}:**`)
  if (party.content !== undefined) {
    lines.push(party.content)
  } else {
    if (party.name) lines.push(party.name)
    if (party.address) lines.push(...party.address.lines)
    for (const { key, prefix } of PARTY_DETAIL_FIELDS) {
      const value = party[key]
      if (value) lines.push(`${prefix}${value}`)
    }
  }
  lines.push('')
}

function renderItems(doc: InvoMLDocument, lines: string[], fmt: NumFmt, hiddenColumns?: Set<string>): void {
  const { hasUnit, hasDiscount, hasTax } = detectItemColumns(doc.items, hiddenColumns)
  const hideDescription = hiddenColumns?.has('description') ?? false
  const hideQty         = hiddenColumns?.has('quantity')    ?? false
  const hideUnitPrice   = hiddenColumns?.has('unitPrice')   ?? false
  const hideAmount      = hiddenColumns?.has('amount')      ?? false

  const cols: string[] = []
  if (!hideDescription) cols.push('Description')
  if (!hideQty)         cols.push('Quantity')
  if (hasUnit)          cols.push('Unit')
  if (!hideUnitPrice)   cols.push('Unit Price')
  if (hasDiscount)      cols.push('Discount')
  if (hasTax)           cols.push('Tax')
  if (!hideAmount)      cols.push('Amount')

  lines.push('| ' + cols.join(' | ') + ' |')
  lines.push('| ' + cols.map(() => '---').join(' | ') + ' |')

  for (const item of doc.items) {
    const row: string[] = []
    if (!hideDescription) row.push(item.description)
    if (!hideQty)         row.push(String(item.quantity))
    if (hasUnit)          row.push(item.unit ?? '')
    if (!hideUnitPrice)   row.push(fmt(item.unitPrice))
    if (hasDiscount)      row.push(item.discount ? formatDiscount(item.discount, fmt) : '')
    if (hasTax)           row.push(item.taxAmount !== undefined ? fmt(item.taxAmount) : '')
    if (!hideAmount)      row.push(fmt(item.amount ?? item.quantity * item.unitPrice))
    lines.push('| ' + row.join(' | ') + ' |')
  }
  lines.push('')
}

function renderTotals(doc: InvoMLDocument, lines: string[], fmt: NumFmt): void {
  if (!doc.totals) return

  const rows = buildTotalsRows(doc.totals, doc.meta.currency, fmt)

  lines.push('| | |')
  lines.push('| ---: | ---: |')

  for (const row of rows) {
    const emphasize = row.kind === 'grand' || row.kind === 'amount-due'
    const labelBold = emphasize || row.kind === 'subtotal'
    const labelStr = labelBold ? `**${row.label}**` : row.label
    const amountStr = emphasize ? `**${row.formattedAmount}**` : row.formattedAmount
    lines.push(`| ${labelStr} | ${amountStr} |`)
  }

  lines.push('')
}

function renderPayment(doc: InvoMLDocument, lines: string[]): void {
  if (!doc.payment) return
  lines.push(`### ${doc.payment.title ?? 'Payment'}`)
  lines.push('')
  if (doc.payment.content) {
    lines.push(doc.payment.content)
  } else {
    for (const { key, label } of PAYMENT_FIELDS) {
      const value = doc.payment[key]
      if (value) lines.push(`**${label}:** ${value}`)
    }
  }
  lines.push('')
}
