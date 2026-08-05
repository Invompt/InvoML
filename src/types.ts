// src/types.ts

/** Root InvoML document — the top-level object exchanged between the AI layer and all renderers. */
export interface InvoMLDocument {
  $invoml: '1.0'
  meta: InvoMLMeta
  from?: InvoMLParty
  to?: InvoMLParty
  items: InvoMLItem[]
  discounts?: InvoMLDiscount[]
  payment?: InvoMLPayment
  paymentAdvice?: InvoMLPaymentAdvice
  sections?: Record<string, InvoMLSection>
  notes?: string
  prepaidAmount?: number
  totals?: InvoMLTotals
  style?: InvoMLStyle
}

/** Visual presentation hints using the finite, renderer-neutral InvoML token vocabulary. */
export interface InvoMLStyle {
  template?: InvoMLTemplate
  dateFormat?: InvoMLDateFormat
  order?: InvoMLBlockName[]
  blocks?: Partial<Record<InvoMLBlockName, InvoMLBlockStyle>>
  hidden?: string[]
  pageFooter?: {
    show?: boolean
    format?: string
  }
}

/** Canonical built-in visual templates. */
export type InvoMLTemplate = 'standard' | 'minimal' | 'professional'

/** Built-in blocks with dedicated document data sources. */
export type InvoMLBuiltInBlockName =
  | 'header'
  | 'from'
  | 'to'
  | 'items'
  | 'totals'
  | 'payment'
  | 'paymentAdvice'
  | 'notes'

/** Any valid presentation block reference. */
export type InvoMLBlockName = InvoMLBuiltInBlockName | `section:${string}`

/** Finite block presentation tokens. Raw CSS is never valid document-authored InvoML. */
export interface InvoMLBlockStyle {
  span?: 'full' | 'half' | 'one-third' | 'two-thirds'
  align?: 'start' | 'center' | 'end'
  breakBefore?: 'page'
  breakAfter?: 'page'
  keepTogether?: boolean
}

/** Finite presentation presets for canonical ISO document dates. */
export type InvoMLDateFormat = 'iso' | 'numeric' | 'medium' | 'long'

/** Document metadata — type, number, dates, currency, locale, and optional tax configuration. */
export interface InvoMLMeta {
  documentType: 'invoice' | 'quote' | 'credit_note' | 'receipt' | 'estimate'
  number: string
  issueDate: string
  currency: string
  dueDate?: string
  expiryDate?: string
  locale?: string
  reference?: string
  creditNoteReference?: string
  tax?: InvoMLTaxSimple | InvoMLTaxFull
}

/** Shorthand single-rate tax configuration. Normalised to `InvoMLTaxFull` internally by `resolveTaxConfig`. */
export interface InvoMLTaxSimple {
  label: string
  rate: number
  inclusive?: boolean
}

/** Full multi-rate or compound tax configuration. Supports VAT categories, withholding, reverse-charge, and inclusive pricing. */
export interface InvoMLTaxFull {
  system?: string
  compound?: boolean
  inclusive?: boolean
  categories: InvoMLTaxCategory[]
}

/** A single tax rate category within an `InvoMLTaxFull` configuration. */
export interface InvoMLTaxCategory {
  id: string
  label: string
  rate: number
  default?: boolean
  exempt?: boolean
  reverseCharge?: boolean
  withholding?: boolean
  inclusive?: boolean
}

/** A line item in an InvoML document. `amount` and `taxAmount` are derived runtime fields that may be refreshed onto working copies during render/serialization. */
export interface InvoMLItem {
  description: string
  quantity: number
  unitPrice: number
  unit?: string
  discount?: string | InvoMLDiscount
  taxCategory?: string
  /** Derived at runtime — not a source field. Treat as cached/derived. */
  amount?: number
  /** Derived at runtime — not a source field. Treat as cached/derived. */
  taxAmount?: number
}

/** A discount applied either at the item level or as an invoice-level entry in `doc.discounts`. */
export interface InvoMLDiscount {
  type: 'percentage' | 'fixed'
  value: number
  label?: string
}

/** Postal address with explicit, ordered lines. Empty entries preserve intentional blank lines. */
export interface InvoMLAddress {
  lines: string[]
}

/** Free-form party representation. Structured fields are mutually exclusive with `content`. */
export interface InvoMLFreeformParty {
  content: string
  name?: never
  address?: never
  taxId?: never
  email?: never
  phone?: never
  website?: never
  businessNumber?: never
  attention?: never
  countryCode?: never
}

interface InvoMLStructuredPartyFields {
  name?: string
  address?: InvoMLAddress
  taxId?: string
  email?: string
  phone?: string
  website?: string
  businessNumber?: string
  attention?: string
  countryCode?: string
}

type RequireAtLeastOne<T, K extends keyof T = keyof T> =
  K extends keyof T ? Required<Pick<T, K>> & Partial<Omit<T, K>> : never

/** Structured party representation with at least one structured field. */
export type InvoMLStructuredParty = {
  content?: never
} & RequireAtLeastOne<InvoMLStructuredPartyFields>

/** Issuer (`from`) or recipient (`to`), represented either as free-form Markdown or structured fields. */
export type InvoMLParty = InvoMLFreeformParty | InvoMLStructuredParty

/** Payment instructions rendered in the `payment` block. Use `content` for freeform markdown, or populate structured fields (IBAN, SWIFT, crypto, etc.). */
export interface InvoMLPayment {
  title?: string
  content?: string
  method?: 'bank-international' | 'bank-domestic' | 'crypto' | 'card' | 'other'
  beneficiary?: string
  bank?: string
  iban?: string
  swift?: string
  routingNumber?: string
  accountNumber?: string
  cryptoAddress?: string
  cryptoNetwork?: string
}

/** Opt-in remittance stub. Financial values are always computed at render time. */
export interface InvoMLPaymentAdvice {
  title?: string
  content?: string
}

/** A custom content section (e.g. terms and conditions, additional notes). Referenced in `style.order` as `section:<key>`. */
export interface InvoMLSection {
  title: string
  content: string
}

/** A single discount entry within `InvoMLTotals.discountDetails`. */
export interface InvoMLDiscountDetail {
  label?: string
  amount: number
}

/** Computed totals produced by `calculate` and stored back onto `doc.totals`. All amounts are in the document currency. */
export interface InvoMLTotals {
  subtotal: number
  discountDetails?: InvoMLDiscountDetail[]
  afterDiscounts: number
  taxDetails?: InvoMLTaxDetail[]
  taxTotal: number
  withholdingTotal: number
  total: number
  prepaidAmount?: number
  amountDue: number
  currencySymbol?: string
  locale?: string
}

/** Per-category tax breakdown entry within `InvoMLTotals.taxDetails`. */
export interface InvoMLTaxDetail {
  category: string
  label?: string
  rate?: number
  base: number
  amount: number
  inclusive?: boolean
  withholding?: boolean
}

/** Common base for all validation result types — schema, domain, and style. */
export interface BaseValidationResult {
  valid: boolean
}

/** Error class for calculation errors defined in SPEC Section 8.2. Includes a machine-readable `code` property. */
export class CalculationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'CalculationError'
  }
}

/** Internal normalised tax config (always in categories form) — produced by `resolveTaxConfig`, consumed by `calculate`. Not part of the public document schema. */
export interface ResolvedTaxConfig {
  system: string
  categories: InvoMLTaxCategory[]
  compound: boolean
  inclusive: boolean
}
