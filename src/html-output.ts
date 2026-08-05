// src/html-renderer.ts — Orchestrates block rendering into a self-contained HTML document.

import type {
  InvoMLDocument,
  InvoMLBlockStyle,
  InvoMLParty,
  InvoMLPayment,
  InvoMLTotals,
} from './types.js'
import type { ResolvedPaymentAdvice } from './presentation-internal.js'
import { resolveStyle, parseSectionKey, resolvePageFooter } from './style.js'
import { resolveTheme } from './themes.js'
import { buildFormatter, formatDiscount, formatDocumentType } from './format.js'
import { escapeHtml, processInline, processMarkdown } from './markdown.js'
import { BASE_CSS, TEMPLATE_CSS } from './html-css.js'
import { applyEditable } from './editable.js'
import { PARTY_DETAIL_FIELDS, PAYMENT_FIELDS, detectItemColumns, buildTotalsRows } from './render-shared.js'
import { resolveInvoiceLocale, type InvoiceLabels } from './locale.js'
import { formatDate } from './date.js'
import type { RenderOptions } from './render-options.js'

// Alias for brevity within this module
const esc = escapeHtml

function blockPresentationAttrs(tokens: InvoMLBlockStyle): string {
  return [
    `data-invoml-span="${esc(tokens.span ?? 'full')}"`,
    tokens.align ? `data-invoml-align="${esc(tokens.align)}"` : '',
    tokens.breakBefore ? `data-invoml-break-before="${esc(tokens.breakBefore)}"` : '',
    tokens.breakAfter ? `data-invoml-break-after="${esc(tokens.breakAfter)}"` : '',
    tokens.keepTogether === true ? 'data-invoml-keep-together="true"' : '',
  ].filter(Boolean).join(' ')
}

function buildTrustedContainerProperties(properties: Record<string, string>): string {
  const declarations = Object.entries(properties)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')
  return declarations ? `.invoml-container.invoml-container {\n${declarations}\n}` : ''
}

function documentTitle(labels: InvoiceLabels, type: string): string {
  const localized = labels.documentTypes[type as keyof InvoiceLabels['documentTypes']]
  return localized ?? formatDocumentType(type)
}

// ─── Block renderers ──────────────────────────────────────────────────────────

function renderHeader(
  doc: InvoMLDocument,
  labels: InvoiceLabels,
  dateFmt: (value: string) => string,
  blockStyle: InvoMLBlockStyle,
  hiddenMeta?: Set<string>,
): string {
  const { meta } = doc
  const type = documentTitle(labels, meta.documentType)
  const presentationAttrs = blockPresentationAttrs(blockStyle)

  const metaItems: string[] = []

  metaItems.push(metaItem(labels.meta.date, dateFmt(meta.issueDate), 'meta.issueDate'))
  if (meta.dueDate && !hiddenMeta?.has('dueDate')) metaItems.push(metaItem(labels.meta.due, dateFmt(meta.dueDate), 'meta.dueDate'))
  if (meta.expiryDate && !hiddenMeta?.has('expiryDate')) metaItems.push(metaItem(labels.meta.expires, dateFmt(meta.expiryDate), 'meta.expiryDate'))
  if (!hiddenMeta?.has('currency')) metaItems.push(metaItem(labels.meta.currency, meta.currency, 'meta.currency'))
  if (meta.reference && !hiddenMeta?.has('reference')) metaItems.push(metaItem(labels.meta.reference, meta.reference, 'meta.reference'))
  if (meta.creditNoteReference && !hiddenMeta?.has('creditNoteReference')) metaItems.push(metaItem(labels.meta.creditReference, meta.creditNoteReference, 'meta.creditNoteReference'))

  return `
<header class="invoml-header" data-invoml-block="header" ${presentationAttrs}>
  <div class="invoml-header-title" data-invoml-field="meta.documentType" data-invoml-type="text">${esc(type)}</div>
  <div class="invoml-header-number" data-invoml-field="meta.number" data-invoml-type="text">${esc(meta.number)}</div>
  <div class="invoml-header-meta">
    ${metaItems.join('\n    ')}
  </div>
</header>`
}

function metaItem(label: string, value: string, field: string): string {
  return `<div class="invoml-header-meta-item"><span class="invoml-header-meta-label">${esc(label)}</span><span class="invoml-header-meta-value" data-invoml-field="${esc(field)}" data-invoml-type="text">${esc(value)}</span></div>`
}

function renderParty(
  role: 'from' | 'to',
  party: InvoMLParty | undefined,
  labels: InvoiceLabels,
  blockStyle: InvoMLBlockStyle
): string {
  if (!party) return ''

  const label = role === 'from' ? labels.party.from : labels.party.to
  const ariaLabel = role === 'from' ? labels.party.issuedBy : labels.party.billedTo
  const presentationAttrs = blockPresentationAttrs(blockStyle)

  let inner: string
  if (party.content !== undefined) {
    inner = `<div class="invoml-party-details" data-invoml-field="${role}.content" data-invoml-type="markdown-block">${processMarkdown(party.content)}</div>`
  } else {
    const rows: string[] = []
    if (party.name) rows.push(`<div class="invoml-party-name" data-invoml-field="${role}.name" data-invoml-type="markdown">${processInline(party.name)}</div>`)
    const details: string[] = []
    if (party.address) {
      const addressLines = party.address.lines.map((line, index) => {
        const content = line === '' ? '<br>' : esc(line)
        return `<div class="invoml-address-line" data-invoml-field="${role}.address.lines.${index}" data-invoml-type="text">${content}</div>`
      })
      details.push(`<div class="invoml-party-address">${addressLines.join('')}</div>`)
    }
    for (const { key, prefix } of PARTY_DETAIL_FIELDS) {
      const value = party[key]
      if (!value) continue
      const localizedPrefix = key === 'attention'
        ? `${labels.party.attention}: `
        : key === 'taxId'
          ? `${labels.party.taxId}: `
          : key === 'businessNumber'
            ? `${labels.party.businessNumber}: `
            : prefix
      details.push(`<div data-invoml-field="${role}.${key}" data-invoml-type="text">${esc(localizedPrefix)}${esc(value)}</div>`)
    }
    if (details.length > 0) {
      rows.push(`<div class="invoml-party-details">${details.join('')}</div>`)
    }
    inner = rows.join('\n')
  }

  return `
<div class="invoml-party invoml-party-${role}" data-invoml-block="${role}" aria-label="${ariaLabel}" ${presentationAttrs}>
  <div class="invoml-party-label">${esc(label)}</div>
  ${inner}
</div>`
}

function renderItems(
  doc: InvoMLDocument,
  fmt: (n: number) => string,
  labels: InvoiceLabels,
  blockStyle: InvoMLBlockStyle,
  hiddenColumns?: Set<string>,
): string {
  const { hasUnit, hasDiscount, hasTax } = detectItemColumns(doc.items, hiddenColumns)
  const hideQty = hiddenColumns?.has('quantity') ?? false
  const hideUnitPrice = hiddenColumns?.has('unitPrice') ?? false
  const hideDescription = hiddenColumns?.has('description') ?? false
  const hideAmount = hiddenColumns?.has('amount') ?? false

  const presentationAttrs = blockPresentationAttrs(blockStyle)

  const thRight = (label: string) => `<th class="col-right">${esc(label)}</th>`
  const headers = [
    hideDescription ? '' : `<th data-invoml-field="items.*.description">${esc(labels.items.description)}</th>`,
    hideQty         ? '' : `<th class="col-right">${esc(labels.items.quantity)}</th>`,
    hasUnit ? `<th>${esc(labels.items.unit)}</th>` : '',
    hideUnitPrice   ? '' : thRight(labels.items.unitPrice),
    hasDiscount ? thRight(labels.items.discount) : '',
    hasTax ? thRight(labels.items.tax) : '',
    hideAmount      ? '' : thRight(labels.items.amount),
  ].filter(Boolean).join('\n        ')

  const rows = doc.items.map((item, idx) => {
    const amount = item.amount ?? item.quantity * item.unitPrice
    const discountStr = item.discount ? formatDiscount(item.discount, fmt) : ''

    const cells = [
      hideDescription ? '' : `<td data-invoml-field="items.${idx}.description" data-invoml-type="markdown">${processInline(item.description)}</td>`,
      hideQty         ? '' : `<td class="col-right" data-invoml-field="items.${idx}.quantity" data-invoml-type="number">${esc(String(item.quantity))}</td>`,
      hasUnit ? `<td data-invoml-field="items.${idx}.unit" data-invoml-type="text">${esc(item.unit ?? '')}</td>` : '',
      hideUnitPrice   ? '' : `<td class="col-right" data-invoml-field="items.${idx}.unitPrice" data-invoml-type="currency">${esc(fmt(item.unitPrice))}</td>`,
      hasDiscount ? `<td class="col-right" data-invoml-field="items.${idx}.discount" data-invoml-type="text">${esc(discountStr)}</td>` : '',
      hasTax ? `<td class="col-right" data-invoml-field="items.${idx}.taxAmount" data-invoml-type="currency" data-invoml-computed>${item.taxAmount !== undefined ? esc(fmt(item.taxAmount)) : ''}</td>` : '',
      hideAmount      ? '' : `<td class="col-right" data-invoml-field="items.${idx}.amount" data-invoml-type="currency" data-invoml-computed>${esc(fmt(amount))}</td>`,
    ].filter(Boolean).join('\n        ')

    return `    <tr>\n        ${cells}\n      </tr>`
  }).join('\n')

  return `
<table class="invoml-items" data-invoml-block="items" ${presentationAttrs}>
  <thead>
    <tr>
        ${headers}
    </tr>
  </thead>
  <tbody>
${rows}
  </tbody>
</table>`
}

function renderTotals(
  totals: InvoMLTotals | undefined,
  currency: string,
  fmt: (n: number) => string,
  labels: InvoiceLabels,
  blockStyle: InvoMLBlockStyle,
): string {
  if (!totals) return ''

  const presentationAttrs = blockPresentationAttrs(blockStyle)
  const totalsRows = buildTotalsRows(totals, currency, fmt, labels.totals)

  const htmlRows: string[] = totalsRows.map(r => {
    const emphasize = r.kind === 'grand' || r.kind === 'amount-due'
    const extraClass = r.kind === 'grand' ? ' is-grand' : r.kind === 'amount-due' ? ' is-amount-due' : ''
    const labelClass = `invoml-totals-label${emphasize ? ' is-bold' : ''}`
    return `<div class="invoml-totals-row${extraClass}" aria-label="${esc(r.label)}">
      <span class="${labelClass}">${esc(r.label)}</span>
      <span class="invoml-totals-amount" data-invoml-computed>${esc(r.formattedAmount)}</span>
    </div>`
  })

  return `
<div class="invoml-totals" data-invoml-block="totals" aria-label="${esc(labels.totals.summary)}" ${presentationAttrs}>
  <div class="invoml-totals-inner">
    ${htmlRows.join('\n    ')}
  </div>
</div>`
}

function renderPayment(
  payment: InvoMLPayment | undefined,
  labels: InvoiceLabels,
  blockStyle: InvoMLBlockStyle,
): string {
  if (!payment) return ''

  const presentationAttrs = blockPresentationAttrs(blockStyle)
  const title = payment.title ?? labels.payment.title

  let inner: string
  if (payment.content) {
    inner = `<div class="invoml-payment-details" data-invoml-field="payment.content" data-invoml-type="markdown-block">${processMarkdown(payment.content)}</div>`
  } else {
    const fields: string[] = []
    for (const { key, label } of PAYMENT_FIELDS) {
      const value = payment[key]
      if (!value) continue
      const localizedLabel = key === 'beneficiary'
        ? labels.payment.beneficiary
        : key === 'bank'
          ? labels.payment.bank
          : key === 'routingNumber'
            ? labels.payment.routing
            : key === 'accountNumber'
              ? labels.payment.account
              : key === 'cryptoAddress'
                ? labels.payment.address
                : key === 'cryptoNetwork'
                  ? labels.payment.network
                  : label
      fields.push(`<strong>${esc(localizedLabel)}:</strong> ${esc(value)}`)
    }
    inner = `<div class="invoml-payment-details">${fields.join('<br>\n')}</div>`
  }

  return `
<section class="invoml-payment" data-invoml-block="payment" ${presentationAttrs}>
  <div class="invoml-payment-title" data-invoml-field="payment.title" data-invoml-type="text">${esc(title)}</div>
  ${inner}
</section>`
}

function renderPaymentAdvice(
  advice: ResolvedPaymentAdvice | undefined,
  fmt: (n: number) => string,
  dateFmt: (value: string) => string,
  labels: InvoiceLabels,
  blockStyle: InvoMLBlockStyle,
): string {
  if (!advice) return ''
  const presentationAttrs = blockPresentationAttrs(blockStyle)
  const field = (name: string, label: string, value: string) => `
    <div class="invoml-payment-advice-field" data-invoml-payment-advice-field="${name}">
      <span class="invoml-payment-advice-label">${esc(label)}</span>
      <span class="invoml-payment-advice-value" data-invoml-computed contenteditable="false">${esc(value)}</span>
    </div>`

  return `
<section class="invoml-payment-advice" data-invoml-block="paymentAdvice" data-invoml-payment-advice="computed" ${presentationAttrs}>
  <h2 class="invoml-payment-advice-title" data-invoml-field="paymentAdvice.title" data-invoml-type="text">${esc(advice.title)}</h2>
  ${advice.content ? `<div class="invoml-payment-advice-content" data-invoml-field="paymentAdvice.content" data-invoml-type="markdown-block">${processMarkdown(advice.content)}</div>` : ''}
  <div class="invoml-payment-advice-grid">
    ${field('number', labels.paymentAdvice.invoiceNumber, advice.number)}
    ${advice.dueDate ? field('dueDate', labels.paymentAdvice.dueDate, dateFmt(advice.dueDate)) : ''}
    ${field('customer', labels.paymentAdvice.customer, advice.customer)}
    ${field('amountDue', labels.paymentAdvice.amountDue, fmt(advice.amountDue))}
    ${field('amountEnclosed', labels.paymentAdvice.amountEnclosed, '')}
  </div>
</section>`
}

function renderNotes(notes: string | undefined, blockStyle: InvoMLBlockStyle): string {
  if (!notes) return ''
  const presentationAttrs = blockPresentationAttrs(blockStyle)
  return `
<footer class="invoml-notes" data-invoml-block="notes" ${presentationAttrs}>
  <div data-invoml-field="notes" data-invoml-type="markdown-block">${processMarkdown(notes)}</div>
</footer>`
}

function renderSection(
  key: string,
  section: { title: string; content: string },
  blockStyle: InvoMLBlockStyle
): string {
  const presentationAttrs = blockPresentationAttrs(blockStyle)
  return `
<section class="invoml-section" data-invoml-block="section:${esc(key)}" data-invoml-section="${esc(key)}" ${presentationAttrs}>
  <h2 class="invoml-section-title" data-invoml-field="sections.${esc(key)}.title" data-invoml-type="text">${esc(section.title)}</h2>
  <div class="invoml-section-content" data-invoml-field="sections.${esc(key)}.content" data-invoml-type="markdown-block">${processMarkdown(section.content)}</div>
</section>`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// ─── Render options ──────────────────────────────────────────────────────────

// ─── Main export ──────────────────────────────────────────────────────────────

// ─── Block dispatch map ───────────────────────────────────────────────────────

type BlockRenderer = (blockStyle: InvoMLBlockStyle) => string | null

function buildBlockDispatch(
  doc: InvoMLDocument,
  fmt: (n: number) => string,
  dateFmt: (value: string) => string,
  labels: InvoiceLabels,
  hiddenColumns: Set<string>,
  hiddenMeta: Set<string>,
  paymentAdvice?: ResolvedPaymentAdvice,
): Record<string, BlockRenderer> {
  return {
    header:  (bs) => renderHeader(doc, labels, dateFmt, bs, hiddenMeta),
    from:    (bs) => doc.from    ? renderParty('from', doc.from, labels, bs)                         : null,
    to:      (bs) => doc.to      ? renderParty('to', doc.to, labels, bs)                             : null,
    items:   (bs) => renderItems(doc, fmt, labels, bs, hiddenColumns),
    totals:  (bs) => doc.totals  ? renderTotals(doc.totals, doc.meta.currency, fmt, labels, bs)      : null,
    payment: (bs) => doc.payment ? renderPayment(doc.payment, labels, bs)                            : null,
    paymentAdvice: (bs) => paymentAdvice ? renderPaymentAdvice(paymentAdvice, fmt, dateFmt, labels, bs) : null,
    notes:   (bs) => doc.notes   ? renderNotes(doc.notes, bs)                                       : null,
  }
}

/**
 * Render an InvoML document as an HTML string.
 *
 * Output modes controlled by `options` (`RenderOptions`):
 * - Default: returns a full `<!DOCTYPE html>` document with `<head>` and `<body>`.
 * - `fragment: true` — returns only `<style>…</style><div class="invoml-container">…</div>`,
 *   suitable for iframe `srcdoc` or direct DOM injection.
 * - `editable: true` — adds `contenteditable` and `aria-label` attributes to every
 *   editable field; computed fields (item amounts, tax) receive `contenteditable="false"`.
 *
 * Styles are layered: BASE_CSS → built-in template CSS → trusted runtime theme properties
 * (`options.theme`) → trusted `options.customCss` (last wins).
 * Computed line fields are refreshed in a working copy before rendering; totals are refreshed only when `doc.totals` is present.
 */
export function renderHTMLDocumentInternal(
  renderDoc: InvoMLDocument,
  options?: RenderOptions,
  paymentAdvice?: ResolvedPaymentAdvice,
): string {
  const style = resolveStyle(renderDoc)
  const template = style.template
  const locale = resolveInvoiceLocale(renderDoc.meta.locale)
  const pageFooter = resolvePageFooter(renderDoc)

  const theme = options?.theme !== undefined ? resolveTheme(options.theme) : undefined

  const styleParts: string[] = [BASE_CSS]
  if (template && TEMPLATE_CSS[template]) {
    styleParts.push(TEMPLATE_CSS[template])
  }
  if (theme && Object.keys(theme.properties).length > 0) {
    styleParts.push(buildTrustedContainerProperties(theme.properties))
  }
  if (options?.customCss) {
    styleParts.push(options.customCss)
  }

  const titleStr = `${documentTitle(locale.labels, renderDoc.meta.documentType)} ${renderDoc.meta.number}`

  const fmt = buildFormatter(renderDoc.meta.currency, renderDoc.meta.locale)
  // Editable output keeps canonical ISO date text so generic DOM round-trip extraction
  // cannot write a localized presentation string back into an ISO-only source field.
  const dateFmt = options?.editable
    ? (value: string) => value
    : (value: string) => formatDate(value, renderDoc.meta.locale, style.dateFormat)
  const { hidden } = style
  const dispatch = buildBlockDispatch(renderDoc, fmt, dateFmt, locale.labels, hidden.columns, hidden.meta, paymentAdvice)
  const renderedBlocks: Array<{
    html: string
    span: NonNullable<InvoMLBlockStyle['span']>
    breakBefore: boolean
    breakAfter: boolean
  }> = []

  const order = style.order
  let i = 0
  while (i < order.length) {
    const block = order[i]

    // Skip hidden blocks before any further processing
    if (hidden.blocks.has(block)) {
      i++
      continue
    }

    const isVisibleConsecutiveParty =
      (
        block === 'from'
        && order[i + 1] === 'to'
        && !hidden.blocks.has('to')
      )
      || (
        block === 'to'
        && order[i - 1] === 'from'
        && !hidden.blocks.has('from')
      )
    const defaultPartySpan = isVisibleConsecutiveParty && renderDoc.from && renderDoc.to
      ? { span: 'half' as const }
      : {}
    const blockStyle = { ...defaultPartySpan, ...(style.blocks[block] ?? {}) }

    if (Object.prototype.hasOwnProperty.call(dispatch, block)) {
      const result = dispatch[block](blockStyle)
      if (result !== null) renderedBlocks.push({
        html: result,
        span: blockStyle.span ?? 'full',
        breakBefore: blockStyle.breakBefore === 'page',
        breakAfter: blockStyle.breakAfter === 'page',
      })
    } else {
      const sectionKey = parseSectionKey(block)
      if (sectionKey !== null) {
        const section = renderDoc.sections?.[sectionKey]
        if (section) renderedBlocks.push({
          html: renderSection(sectionKey, section, blockStyle),
          span: blockStyle.span ?? 'full',
          breakBefore: blockStyle.breakBefore === 'page',
          breakAfter: blockStyle.breakAfter === 'page',
        })
      }
    }
    i++
  }

  const spanUnits: Record<NonNullable<InvoMLBlockStyle['span']>, number> = {
    full: 12,
    half: 6,
    'one-third': 4,
    'two-thirds': 8,
  }
  const rows: string[] = []
  let row: string[] = []
  let used = 0
  let rowBreakBefore = false
  let rowBreakAfter = false
  const flushRow = () => {
    if (row.length === 0) return
    const breakAttrs = [
      rowBreakBefore ? 'data-invoml-row-break-before="page"' : '',
      rowBreakAfter ? 'data-invoml-row-break-after="page"' : '',
    ].filter(Boolean).join(' ')
    rows.push(`<div class="invoml-presentation-row" data-invoml-row${breakAttrs ? ` ${breakAttrs}` : ''}>${row.join('\n')}</div>`)
    row = []
    used = 0
    rowBreakBefore = false
    rowBreakAfter = false
  }
  for (const rendered of renderedBlocks) {
    const units = spanUnits[rendered.span]
    if (rendered.breakBefore) flushRow()
    if (used > 0 && used + units > 12) flushRow()
    if (row.length === 0 && rendered.breakBefore) rowBreakBefore = true
    row.push(rendered.html)
    used += units
    if (rendered.breakAfter) rowBreakAfter = true
    if (used === 12 || rendered.breakAfter) flushRow()
  }
  flushRow()

  const containerClass = ['invoml-container', theme?.densityClass].filter(Boolean).join(' ')
  const containerAttrs = [
    `class="${containerClass}"`,
    `lang="${esc(locale.locale)}"`,
    `dir="${locale.direction}"`,
    `data-invoml-locale="${esc(locale.locale)}"`,
    template ? `data-invoml-template="${esc(template)}"` : '',
    pageFooter.show
      ? `data-invoml-page-footer="show" data-invoml-page-footer-format="${esc(pageFooter.format)}"`
      : 'data-invoml-page-footer="hidden"',
  ].filter(Boolean).join(' ')

  const styleBlock = `<style>${styleParts.join('\n')}</style>`
  const bodyContent = `<div ${containerAttrs}>
    ${rows.join('\n    ')}
  </div>`

  const applyPostProcess = (html: string) => options?.editable ? applyEditable(html) : html

  if (options?.fragment) {
    return applyPostProcess(`${styleBlock}\n${bodyContent}`)
  }

  return applyPostProcess(`<!DOCTYPE html>
<html lang="${esc(locale.locale)}" dir="${locale.direction}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(titleStr)}</title>
  ${styleBlock}
</head>
<body>
  ${bodyContent}
</body>
</html>`)
}
