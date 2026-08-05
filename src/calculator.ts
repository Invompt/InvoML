import { InternalDecimal, roundHalfUp, getCurrencyDecimals } from './rounding.js'
import { resolveTaxConfig, resolveCategory } from './tax.js'
import { parseDiscount, computeDiscountAmount, allocateProportionally } from './discounts.js'
import { CalculationError } from './types.js'
import type { InvoMLDocument, InvoMLItem, InvoMLTotals, InvoMLTaxDetail } from './types.js'

const inclusiveDivisor = (rate: number) =>
  new InternalDecimal(1).plus(new InternalDecimal(rate.toString()).div(100))

interface CalculationSnapshot {
  items: InvoMLItem[]
  totals: InvoMLTotals
}

function calculateSnapshot(doc: InvoMLDocument): CalculationSnapshot {
  const taxConfig = resolveTaxConfig(doc.meta.tax)
  const dp = getCurrencyDecimals(doc.meta.currency)
  const round = (v: number): number => roundHalfUp(v, dp)

  // Work on shallow copies of items to avoid mutating the caller's input
  const items = doc.items.map(i => ({ ...i }))

  // Cache resolved tax category per item — built once in Step 1, reused in Step 4
  const resolvedCategoryCache = new Map<typeof items[number], ReturnType<typeof resolveCategory>>()

  // ── STEP 1: Line Calculations ──
  for (const item of items) {
    if (!Number.isFinite(item.quantity) || !Number.isFinite(item.unitPrice)) {
      throw new CalculationError('INVALID_ITEM_VALUE', `Item "${item.description ?? ''}" has non-finite quantity or unitPrice`)
    }
    // Use Decimal for multiplication to avoid native float precision loss
    const gross = round(new InternalDecimal(item.quantity).times(item.unitPrice).toNumber())
    const lineDiscount = item.discount ? computeDiscountAmount(parseDiscount(item.discount), gross, dp) : 0
    item.amount = round(new InternalDecimal(gross.toString()).minus(lineDiscount.toString()).toNumber())

    if (taxConfig && !taxConfig.compound) {
      const cat = resolveCategory(item, taxConfig)
      resolvedCategoryCache.set(item, cat)
      if (cat && !cat.exempt && !cat.reverseCharge) {
        if (taxConfig.inclusive) {
          // Use Decimal for the inclusive back-out division
          const divisor = inclusiveDivisor(cat.rate)
          const net = round(new InternalDecimal(item.amount.toString()).dividedBy(divisor).toNumber())
          item.taxAmount = round(new InternalDecimal(item.amount.toString()).minus(net.toString()).toNumber())
        } else {
          // Use Decimal for exclusive tax multiplication
          item.taxAmount = round(new InternalDecimal(item.amount.toString()).times(new InternalDecimal(cat.rate.toString()).dividedBy(100)).toNumber())
        }
      } else {
        item.taxAmount = 0
      }
    } else {
      item.taxAmount = 0
    }
  }

  // ── STEP 2: Subtotal ──
  let subtotal = round(items.reduce((sum, i) => sum.plus(i.amount ?? 0), new InternalDecimal(0)).toNumber())

  // ── STEP 3: Invoice-Level Discounts (cascading) ──
  // Intentional: round after each cascade step for line-by-line auditability.
  // Accumulated rounding errors are accepted in exchange for each intermediate
  // value being a displayable, rounded amount.
  let running = subtotal
  const discountDetails: { label?: string; amount: number }[] = []
  for (const discount of doc.discounts ?? []) {
    const amount = computeDiscountAmount(discount, running, dp)
    discountDetails.push({ label: discount.label, amount })
    running = round(new InternalDecimal(running.toString()).minus(amount.toString()).toNumber())
  }
  const afterDiscounts = running
  const discountTotal = round(new InternalDecimal(subtotal.toString()).minus(afterDiscounts.toString()).toNumber())

  // ── STEP 4: Tax Calculation ──
  const taxDetails: InvoMLTaxDetail[] = []
  let taxTotalD = new InternalDecimal(0)
  let withholdingTotalD = new InternalDecimal(0)

  if (taxConfig === null) {
    // No tax — nothing to do
  } else if (taxConfig.compound) {
    // Compound: all categories apply to full base, taxCategory is ignored
    const base = afterDiscounts
    for (const cat of taxConfig.categories) {
      // Use Decimal for the compound tax multiplication
      const catTax = round(new InternalDecimal(base.toString()).times(new InternalDecimal(cat.rate.toString()).dividedBy(100)).toNumber())
      taxDetails.push({ category: cat.id, label: cat.label, rate: cat.rate, base, amount: catTax, inclusive: false })
      if (cat.withholding) {
        withholdingTotalD = withholdingTotalD.plus(catTax)
      } else if (!cat.reverseCharge) {
        taxTotalD = taxTotalD.plus(catTax)
      }
    }
  } else if (taxConfig.inclusive) {
    // Inclusive: separate regular and withholding categories — same split as exclusive branch
    const regularCats = taxConfig.categories.filter(c => !c.withholding)
    const withholdingCats = taxConfig.categories.filter(c => c.withholding)

    const catAmounts = regularCats.map(cat => {
      const linesInCat = items.filter(i => resolvedCategoryCache.get(i)?.id === cat.id)
      return round(linesInCat.reduce((s, i) => s.plus(i.amount ?? 0), new InternalDecimal(0)).toNumber())
    })
    const catDiscounts = allocateProportionally(catAmounts, discountTotal, subtotal, round)

    for (let idx = 0; idx < regularCats.length; idx++) {
      const cat = regularCats[idx]
      const catNetAfterDiscount = round(new InternalDecimal(catAmounts[idx].toString()).minus(catDiscounts[idx].toString()).toNumber())

      let catTax: number
      let catNetBeforeTax: number

      if (cat.exempt) {
        // Exempt categories have zero tax regardless of rate
        catTax = 0
        catNetBeforeTax = catNetAfterDiscount
      } else {
        // Use Decimal for the inclusive back-out division
        const divisor = inclusiveDivisor(cat.rate)
        catNetBeforeTax = round(new InternalDecimal(catNetAfterDiscount.toString()).dividedBy(divisor).toNumber())
        catTax = round(new InternalDecimal(catNetAfterDiscount.toString()).minus(catNetBeforeTax.toString()).toNumber())
      }

      taxDetails.push({ category: cat.id, label: cat.label, rate: cat.rate, base: catNetBeforeTax, amount: catTax, inclusive: true })
      if (!cat.reverseCharge) {
        taxTotalD = taxTotalD.plus(catTax)
      }
    }

    // Withholding categories in inclusive mode: apply to afterDiscounts base (same as exclusive)
    for (const cat of withholdingCats) {
      const base = afterDiscounts
      const catTax = round(new InternalDecimal(base.toString()).times(new InternalDecimal(cat.rate.toString()).dividedBy(100)).toNumber())
      taxDetails.push({ category: cat.id, label: cat.label, rate: cat.rate, base, amount: catTax, inclusive: false })
      withholdingTotalD = withholdingTotalD.plus(catTax)
    }
  } else {
    // Standard / multi-rate
    // Separate withholding categories (apply to full base) from regular categories
    const regularCats = taxConfig.categories.filter(c => !c.withholding)
    const withholdingCats = taxConfig.categories.filter(c => c.withholding)

    const regularAmounts = regularCats.map(cat => {
      const linesInCat = items.filter(i => resolvedCategoryCache.get(i)?.id === cat.id)
      return round(linesInCat.reduce((s, i) => s.plus(i.amount ?? 0), new InternalDecimal(0)).toNumber())
    })
    const regularDiscounts = allocateProportionally(regularAmounts, discountTotal, subtotal, round)

    for (let idx = 0; idx < regularCats.length; idx++) {
      const cat = regularCats[idx]
      const base = round(new InternalDecimal(regularAmounts[idx].toString()).minus(regularDiscounts[idx].toString()).toNumber())
      // Use Decimal for the exclusive tax multiplication
      const catTax = cat.exempt ? 0 : round(new InternalDecimal(base.toString()).times(new InternalDecimal(cat.rate.toString()).dividedBy(100)).toNumber())
      taxDetails.push({ category: cat.id, label: cat.label, rate: cat.rate, base, amount: catTax, inclusive: false })
      if (!cat.reverseCharge) {
        taxTotalD = taxTotalD.plus(catTax)
      }
    }

    // Withholding categories apply to afterDiscounts (full taxable base)
    for (const cat of withholdingCats) {
      const base = afterDiscounts
      const catTax = round(new InternalDecimal(base.toString()).times(new InternalDecimal(cat.rate.toString()).dividedBy(100)).toNumber())
      taxDetails.push({ category: cat.id, label: cat.label, rate: cat.rate, base, amount: catTax, inclusive: false })
      withholdingTotalD = withholdingTotalD.plus(catTax)
    }
  }

  const taxTotal = round(taxTotalD.toNumber())
  const withholdingTotal = round(withholdingTotalD.toNumber())

  // ── STEP 5: Grand Total ──
  let total: number
  if (taxConfig?.inclusive) {
    total = afterDiscounts
  } else {
    // Use Decimal for the final total addition to avoid float precision loss
    total = round(new InternalDecimal(afterDiscounts.toString()).plus(taxTotal.toString()).minus(withholdingTotal.toString()).toNumber())
  }

  // ── STEP 6: Amount Due ──
  const prepaid = doc.prepaidAmount ?? 0
  const amountDue = round(new InternalDecimal(total.toString()).minus(prepaid.toString()).toNumber())

  return {
    items,
    totals: {
      subtotal,
      discountDetails: discountDetails.length > 0 ? discountDetails : undefined,
      afterDiscounts,
      taxDetails: taxDetails.length > 0 ? taxDetails : undefined,
      taxTotal,
      withholdingTotal,
      total,
      prepaidAmount: prepaid,
      amountDue,
    },
  }
}

/** Compute all totals for an InvoML document using arbitrary-precision decimal arithmetic. Returns subtotal, per-category tax breakdowns, discount details, and amount due. */
export function calculate(doc: InvoMLDocument): InvoMLTotals {
  return calculateSnapshot(doc).totals
}

/** Overwrite computed line fields (`items[].amount`, `items[].taxAmount`) with freshly calculated values. */
export function hydrateComputedItems(doc: InvoMLDocument): InvoMLDocument {
  const { items } = calculateSnapshot(doc)
  doc.items = items
  return doc
}

/** Overwrite computed line fields and `doc.totals` with freshly calculated values. */
export function hydrateCalculatedDocument(doc: InvoMLDocument): InvoMLDocument {
  const { items, totals } = calculateSnapshot(doc)
  doc.items = items
  doc.totals = totals
  return doc
}

/** Clone a document and return a fully refreshed copy with computed line fields and totals populated. */
export function recalculateDocument(doc: InvoMLDocument): { document: InvoMLDocument; totals: InvoMLTotals } {
  const document = structuredClone(doc)
  hydrateCalculatedDocument(document)
  return { document, totals: document.totals! }
}
