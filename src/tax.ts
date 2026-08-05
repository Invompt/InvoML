import type { InvoMLTaxSimple, InvoMLTaxFull, InvoMLTaxCategory, InvoMLItem, ResolvedTaxConfig } from './types.js'
import { CalculationError } from './types.js'

function isTaxFull(tax: InvoMLTaxSimple | InvoMLTaxFull): tax is InvoMLTaxFull {
  return 'categories' in tax
}

/**
 * Normalise either a simple or full tax config into a `ResolvedTaxConfig` for the calculator.
 * Returns `null` when no tax is configured (tax-free document).
 * A `InvoMLTaxSimple` is promoted to a single-category `InvoMLTaxFull` using the label as the category ID.
 */
export function resolveTaxConfig(tax: InvoMLTaxSimple | InvoMLTaxFull | undefined): ResolvedTaxConfig | null {
  if (!tax) return null
  if (isTaxFull(tax)) {
    return {
      system: tax.system ?? 'vat',
      categories: tax.categories,
      compound: tax.compound ?? false,
      inclusive: tax.inclusive ?? false,
    }
  }
  const implicitId = tax.label.toLowerCase().replace(/\s+/g, '-')
  return {
    system: 'vat',
    categories: [{
      id: implicitId, label: tax.label, rate: tax.rate,
      default: true, exempt: false, reverseCharge: false,
      withholding: false, inclusive: tax.inclusive ?? false,
    }],
    compound: false,
    inclusive: tax.inclusive ?? false,
  }
}

/**
 * Resolve the applicable `InvoMLTaxCategory` for a line item.
 * Uses `item.taxCategory` when set; otherwise falls back to the category marked `default: true`.
 * Throws `CalculationError` if the referenced category ID is unknown or no default is defined.
 */
export function resolveCategory(item: InvoMLItem, config: ResolvedTaxConfig): InvoMLTaxCategory {
  if (item.taxCategory) {
    const match = config.categories.find(c => c.id === item.taxCategory)
    if (!match) throw new CalculationError('UNKNOWN_CATEGORY', `Unknown tax category '${item.taxCategory}'`)
    return match
  }
  const defaults = config.categories.filter(c => c.default)
  if (defaults.length > 1) {
    throw new CalculationError('MULTIPLE_DEFAULT_CATEGORIES', `Tax config has ${defaults.length} default categories — exactly one is allowed`)
  }
  if (defaults.length === 0) {
    throw new CalculationError('NO_DEFAULT_CATEGORY', `Item '${item.description}' has no taxCategory and no default category is defined`)
  }
  return defaults[0]
}
