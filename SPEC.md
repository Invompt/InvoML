# InvoML v1.0 — Normative Specification

**Status:** Draft
**Version:** 1.0
**Date:** 2026-03-30
**Schema:** `https://github.com/invompt/InvoML/blob/main/invoml-v1.0.schema.json`

---

## Abstract

InvoML (Invoice Markup Language) is a compact, structured document format for commercial invoices, quotes, credit notes, and receipts. It is designed to serve as the canonical output format for language model invoice generation, separating financial data from presentation concerns while remaining human-readable in its source form. InvoML defines a precise calculation model — covering multi-rate taxation, compound tax, inclusive pricing, withholding, and proportional discount allocation — that produces deterministic, currency-rounded totals from any conformant input. A reference implementation is available as an open-source package; this document defines the standard independently of any implementation.

---

## Notation

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

The phrase "the calculator" refers to any conformant implementation of Section 5 (Calculation Rules).

The phrase "the renderer" refers to any conformant implementation that produces output from a document (Section 7, Serialization).

Field names are shown in `monospace`. String literals are shown in `"double quotes"`. Numeric values are shown as plain numbers.

---

## 1. Design Principles

### 1.1 Token Efficiency

InvoML is designed for use as structured output from large language models. Every field name is short and unambiguous. Optional fields are omitted rather than expressed as null. The format carries only the data needed to calculate and render a commercial document; no fields exist for rendering metadata that can be derived from structure.

### 1.2 Deterministic Arithmetic

Given the same input document, every conformant calculator MUST produce the same numeric output. The specification defines the exact rounding function, the order of operations, and the tie-breaking rule for proportional discount allocation. There is no implementation-defined behavior in the calculation path.

### 1.3 Data–Presentation Separation

InvoML documents carry structured financial data only. Style hints (`style`) are advisory to renderers and do not affect calculation. A document's totals are determined entirely by the data fields; no presentation choice can change a calculated total.

### 1.4 LLM-Native

The format is intended for language model generation. Field names correspond to common invoice vocabulary. The schema supports shorthand forms (e.g., a discount expressed as `"10%"` string) alongside the full object form, reducing the tokens a model needs to produce a valid document. Calculated fields (`amount`, `taxAmount`, `totals`) MAY be omitted from generated documents and MUST be recomputed by any calculator before use.

---

## 2. Document Model

### 2.1 Overview

An InvoML document is a JSON object. The root object MUST contain the fields `$invoml`, `meta`, and `items`. All other top-level fields are OPTIONAL.

```
Document
├── $invoml        string (REQUIRED)
├── meta           Meta (REQUIRED)
├── from           Party (OPTIONAL)
├── to             Party (OPTIONAL)
├── items          Item[] (REQUIRED, minItems: 1)
├── discounts      Discount[] (OPTIONAL)
├── payment        Payment (OPTIONAL)
├── paymentAdvice  PaymentAdvice (OPTIONAL)
├── sections       map<string, Section> (OPTIONAL)
├── notes          string (OPTIONAL)
├── prepaidAmount  number (OPTIONAL)
├── totals         Totals (OPTIONAL, computed)
└── style          Style (OPTIONAL)
```

### 2.2 Version Marker

`$invoml` MUST be the string `"1.0"`. A processor that encounters any other value MUST reject the document as invalid.

### 2.3 Meta

The `meta` object carries document-level metadata. Required fields: `documentType`, `number`, `issueDate`, `currency`.

| Field | Type | Required | Constraints |
|---|---|---|---|
| `documentType` | string enum | REQUIRED | One of: `"invoice"`, `"quote"`, `"credit_note"`, `"receipt"`, `"estimate"` |
| `number` | string | REQUIRED | minLength: 1 |
| `issueDate` | string | REQUIRED | ISO 8601 date: `YYYY-MM-DD` |
| `currency` | string | REQUIRED | ISO 4217 three-letter code: pattern `^[A-Z]{3}$` |
| `dueDate` | string | OPTIONAL | ISO 8601 date: `YYYY-MM-DD` |
| `expiryDate` | string | OPTIONAL | ISO 8601 date: `YYYY-MM-DD`. For quotes; indicates when the quoted prices expire |
| `locale` | string | OPTIONAL | BCP 47 language tag |
| `reference` | string | OPTIONAL | Vendor purchase order or external reference |
| `creditNoteReference` | string | CONDITIONAL | REQUIRED when `documentType` is `"credit_note"` |
| `tax` | TaxSimple or TaxFull | OPTIONAL | Tax configuration; see Section 5 |

When `documentType` is `"credit_note"`, the document MUST include `creditNoteReference` identifying the original invoice.

### 2.4 Party

Both `from` (issuer) and `to` (recipient) share the same Party structure. A party MUST use exactly
one representation: a non-empty free-form `content` field, or one or more structured fields. An
empty Party object is invalid, and `content` MUST NOT be combined with structured fields.

| Field | Type | Constraints |
|---|---|---|
| `content` | string | Complete free-form block; mutually exclusive with every structured field |
| `name` | string | Legal or trade name |
| `address` | Address | `{ "lines": string[] }`; ordered explicit postal-address lines |
| `taxId` | string | VAT number or equivalent |
| `email` | string | Format: email |
| `phone` | string | |
| `website` | string | Format: URI |
| `businessNumber` | string | |
| `attention` | string | Contact person |
| `countryCode` | string | ISO 3166-1 alpha-2: pattern `^[A-Z]{2}$` |

`address.lines` MUST contain at least one non-empty line. Individual entries MUST NOT contain CR or
LF characters; producers MUST use a separate array entry for each line. Empty entries are valid and
MUST be preserved as intentional blank lines. Unicode and right-to-left text are valid line content.

### 2.5 Item

The `items` array MUST contain at least one item. Each item represents one line of the invoice.

| Field | Type | Required | Constraints |
|---|---|---|---|
| `description` | string | REQUIRED | minLength: 1 |
| `quantity` | number | REQUIRED | |
| `unitPrice` | number | REQUIRED | |
| `unit` | string | OPTIONAL | Unit of measure (e.g., `"hr"`, `"kg"`) |
| `discount` | string or Discount | OPTIONAL | See Section 6.1 |
| `taxCategory` | string | OPTIONAL | Must match a category `id` in the tax config |
| `amount` | number | OPTIONAL | Calculated; see Section 5 |
| `taxAmount` | number | OPTIONAL | Calculated; see Section 5 |

`quantity` and `unitPrice` MAY be negative to represent credits or reversals (see test vector 13, credit note).

`amount` and `taxAmount`, if present in an input document, MUST be treated as non-authoritative and MUST be recomputed by the calculator. They are output fields used for display caching.

### 2.6 Discount

An inline discount on an item or in the document-level `discounts` array.

| Field | Type | Required | Constraints |
|---|---|---|---|
| `type` | string enum | REQUIRED | `"percentage"` or `"fixed"` |
| `value` | number | REQUIRED | |
| `label` | string | OPTIONAL | Display label |

The shorthand string form is also accepted for `items[].discount` only: a string matching `^\d+(\.\d+)?%$` is a percentage discount, a string matching `^\d+(\.\d+)?$` is a fixed-amount discount. The object form is always accepted.

### 2.7 Payment

The `payment` object carries payment instructions for the recipient.

| Field | Type | Constraints |
|---|---|---|
| `title` | string | Section heading override |
| `content` | string | Free-form block; if present, overrides all structured fields in rendering |
| `method` | string enum | One of: `"bank-international"`, `"bank-domestic"`, `"crypto"`, `"card"`, `"other"` |
| `beneficiary` | string | |
| `bank` | string | |
| `iban` | string | |
| `swift` | string | |
| `routingNumber` | string | |
| `accountNumber` | string | |
| `cryptoAddress` | string | |
| `cryptoNetwork` | string | |

All fields are OPTIONAL. When `content` is present, a renderer SHOULD use it verbatim.

### 2.8 Payment Advice

`paymentAdvice` opts an invoice into a computed payment/remittance stub. Its
only authored fields are optional `title` and `content` strings; when present,
`title` MUST be non-empty. Financial
values, customer, document number, due date, and amount enclosed are not source
fields.

At render time the resolver MUST calculate `amountDue` from authored invoice
data and MUST ignore cached `totals`, `items[].amount`, and
`items[].taxAmount`. The block is valid only for `invoice`; zero due is valid,
while negative due, non-invoice documents, and calculation failures produce a
diagnostic and skip the block. The input document MUST NOT be mutated.
If the surrounding document cannot be calculated, presentation resolution MAY
return a diagnostic preview of the authored document, but it MUST omit payment
advice and MUST NOT synthesize advice from cached financial values. Such a
preview does not make the document valid for persistence.

### 2.9 Section

Sections are arbitrary named blocks of additional content. The `sections` field is a map from string keys to Section objects. Keys MUST match `^[a-zA-Z0-9_-]+$`.

| Field | Type | Required |
|---|---|---|
| `title` | string | REQUIRED |
| `content` | string | REQUIRED |

A section is referenced in `style.order` as `"section:{key}"`.

#### 2.9.1 Content Markdown

String fields rendered as block Markdown (`from.content`, `to.content`,
`payment.content`, `sections.*.content`, and `notes`) support a constrained
Markdown subset:

- bold, italic, underline, and HTTP(S) or `mailto:` links;
- unordered and ordered lists;
- ATX headings levels 1–3 (`#`, `##`, and `###`) when the marker begins a line
  and is followed by whitespace.

Headings provide nested hierarchy inside one content block. Authors SHOULD use
separate titled `sections` entries for peer document blocks and SHOULD use
`###` headings for subordinate groups inside a titled section. Renderers MUST
emit semantic `h1`, `h2`, or `h3` elements for supported headings and MUST NOT
display the leading Markdown markers.

Inline Markdown fields such as party names and item descriptions do not support
block headings or lists.

### 2.10 Totals

The `totals` object, when present in a stored or transmitted document, records the calculated financial summary. It MUST be produced by a conformant calculator (Section 5) and MUST NOT be authored by hand. Every `totals` field present in an input to the calculator is ignored during calculation. `prepaidAmount` is accepted only at the document root.

| Field | Type | Constraints |
|---|---|---|
| `subtotal` | number | Sum of all line amounts after line-level discounts |
| `discountDetails` | DiscountDetail[] | One entry per invoice-level discount; omitted if no invoice discounts |
| `afterDiscounts` | number | Subtotal after all invoice-level discounts |
| `taxDetails` | TaxDetail[] | One entry per tax category; omitted if no tax |
| `taxTotal` | number | Sum of non-withholding, non-reverse-charge tax |
| `withholdingTotal` | number | Sum of withholding tax; may be omitted if zero |
| `total` | number | Grand total payable |
| `prepaidAmount` | number | Computed copy of the root-level input |
| `amountDue` | number | `total - prepaidAmount` |
| `currencySymbol` | string | OPTIONAL; renderer hint only |
| `locale` | string | OPTIONAL; renderer hint only |

A `TaxDetail` entry:

| Field | Type |
|---|---|
| `category` | string (category id) |
| `label` | string (OPTIONAL) |
| `rate` | number (OPTIONAL) |
| `base` | number |
| `amount` | number |
| `inclusive` | boolean (OPTIONAL) |
| `withholding` | boolean (OPTIONAL) |

---

## 3. Tax Model

### 3.1 Overview

Tax configuration lives in `meta.tax`. A document with no `meta.tax` has no tax applied. Two forms are accepted:

- **TaxSimple** — a single tax rate applied to the whole document.
- **TaxFull** — one or more named categories with per-category behavior flags.

### 3.2 TaxSimple

```
TaxSimple
├── label     string (REQUIRED)  — display label, e.g. "VAT"
├── rate      number (REQUIRED)  — percentage, e.g. 20 for 20%
└── inclusive boolean (OPTIONAL) — default false
```

A TaxSimple is normalized at calculation time into a single-category TaxFull. The generated category `id` is derived by lowercasing `label` and replacing spaces with hyphens (e.g., `"VAT"` becomes `"vat"`). The category is marked `default: true`.

### 3.3 TaxFull

```
TaxFull
├── system     string (OPTIONAL)    — advisory identifier, e.g. "eu-vat"
├── compound   boolean (OPTIONAL)   — default false
├── inclusive  boolean (OPTIONAL)   — default false
└── categories TaxCategory[] (REQUIRED, minItems: 1)
```

### 3.4 TaxCategory

```
TaxCategory
├── id            string (REQUIRED)  — unique identifier within this document
├── label         string (REQUIRED)  — display label
├── rate          number (REQUIRED)  — percentage
├── default       boolean (OPTIONAL) — if true, items without taxCategory use this
├── exempt        boolean (OPTIONAL) — if true, rate is effectively 0 for this category
├── reverseCharge boolean (OPTIONAL) — if true, tax is computed but excluded from taxTotal
├── withholding   boolean (OPTIONAL) — if true, tax is deducted from total rather than added
└── inclusive     boolean (OPTIONAL) — RESERVED; inclusive is set at TaxFull level
```

Category flags are mutually exclusive in the following sense:
- A category marked `exempt: true` MUST have its computed tax amount treated as zero.
- A category marked `reverseCharge: true` MUST have its computed tax amount recorded in `taxDetails` but MUST NOT contribute to `taxTotal` or `withholdingTotal`.
- A category marked `withholding: true` MUST contribute to `withholdingTotal` and MUST be deducted from the total rather than added.

### 3.5 Category Resolution

When processing an item, the calculator resolves the item's tax category as follows:

1. If `item.taxCategory` is set, find the TaxCategory whose `id` equals `item.taxCategory`. If no match is found, the calculator MUST raise a `UNKNOWN_CATEGORY` error.
2. If `item.taxCategory` is not set, find all categories where `default: true`. If none exists, the calculator MUST raise a `NO_DEFAULT_CATEGORY` error. Use the first matching default category.

### 3.6 Compound Tax

When `compound: true`, all categories apply to the same base (`afterDiscounts`) regardless of item-level `taxCategory` assignments. The `taxCategory` field on items is ignored in compound mode. Each category contributes independently to `taxTotal` or `withholdingTotal`.

**Example (VEC-07, Canada GST+PST):** Base = 1000. GST at 5% = 50. PST at 7% = 70. Total tax = 120. Total = 1120.

### 3.7 Inclusive Tax

When `inclusive: true`, the line amounts already contain tax. The calculator backs the tax out of the base rather than adding it on top. The grand total equals `afterDiscounts` (not `afterDiscounts + taxTotal`).

For a single inclusive category at rate `r` (as a percentage):

```
net_before_tax = amount / (1 + r / 100)
tax_amount     = amount - net_before_tax
```

**Example (VEC-08, Australia GST):** Line amount = 1650. GST inclusive at 10%.
`net = 1650 / 1.10 = 1500`. `tax = 1650 - 1500 = 150`. Total = 1650 (unchanged).

For multi-category inclusive documents with invoice-level discounts, see Section 5.5, Sub-case C (Inclusive mode).

### 3.8 Reverse Charge

A category marked `reverseCharge: true` represents a VAT mechanism where the buyer is liable for the tax. The seller computes and records the tax amount in `taxDetails` for the buyer's information, but this amount is NOT added to `taxTotal` and does NOT appear in the total.

**Example (VEC-09):** Standard item 1000 at 21% = 210 tax (added to total). Reverse charge item 2000 at 21% = 420 tax (recorded in taxDetails only). taxTotal = 210. Total = 3210.

### 3.9 Withholding Tax

A category marked `withholding: true` is a tax that the buyer must withhold and remit on the seller's behalf. It is deducted from the total rather than added. Withholding categories always apply to `afterDiscounts` as the base, regardless of item assignments.

**Example (VEC-10, Mexico IVA + WHT):** Base = 10000. IVA at 16% = 1600 (added). WHT at 10.67% = 1067 (deducted). Total = 10000 + 1600 - 1067 = 10533.

---

## 4. Discount Model

### 4.1 Line-Level Discounts

A discount on an individual item (via `item.discount`) is applied to the gross line amount before any tax or invoice-level discounts.

Gross line amount = `quantity × unitPrice`, rounded to 2 decimal places using half-up rounding.

For a **percentage** discount at rate `p`:

```
discount_amount = round(gross × p / 100)
item.amount     = round(gross − discount_amount)
```

For a **fixed** discount at value `v`:

```
discount_amount = round(min(v, |gross|))  — capped at the absolute gross
item.amount     = gross − discount_amount  (preserving sign of gross)
```

### 4.2 Invoice-Level Discounts

Invoice-level discounts are stored in the top-level `discounts` array. They are applied to the subtotal after all line-level discounts have been computed.

### 4.3 Cascading Application

When multiple invoice-level discounts are present, they are applied **sequentially** (cascading). Each discount applies to the running total left by the previous discount, not to the original subtotal.

**Example (VEC-06, cascading):** Subtotal = 1000.
Discount 1: 10% of 1000 = 100 → running = 900.
Discount 2: 5% of 900 = 45 → running = 855.
`afterDiscounts` = 855.

### 4.4 Proportional Allocation to Tax Categories

When invoice-level discounts reduce the taxable base across multiple tax categories, the total discount MUST be allocated to each category proportionally to that category's share of the subtotal. This allocation determines the `base` for each category's tax calculation.

For each category `c` (excluding withholding categories), the allocated discount is:

```
category_proportion = category_net / subtotal
category_discount   = round(discount_total × category_proportion)
base_c              = round(category_net − category_discount)
```

where `category_net` is the sum of line amounts belonging to category `c`, and `discount_total = subtotal − afterDiscounts`.

**Tie-breaking:** The last regular category (in declaration order) absorbs any residual rounding difference. After computing allocated discounts for all categories except the last, the last category's discount is:

```
last_category_discount = discount_total − sum_of_all_prior_allocated_discounts
```

This guarantees that the sum of all per-category bases equals `afterDiscounts`.

**Example (VEC-04):** Subtotal = 1000 (Standard 800, Reduced 200). Invoice discount 10% = 100. Standard proportion = 0.8 → discount 80, base 720. Reduced gets residual → discount 20, base 180. Tax: Standard 720 × 20% = 144. Reduced 180 × 10% = 18. taxTotal = 162.

**Example (VEC-18, three categories):** Subtotal = 1000 (A: 333.33, B: 333.33, C: 333.34). Fixed discount 100.
`discount_total` = 100.
Category A proportion = 333.33/1000 = 0.3333 → allocated = round(33.33) = 33.33.
Category B proportion = 333.33/1000 = 0.3333 → allocated = round(33.33) = 33.33.
Category C (last) gets residual: 100 − 33.33 − 33.33 = 33.34.
Bases: A = 300.00, B = 300.00, C = 300.00. Tax: A 60, B 30, C 15. taxTotal = 105.

---

## 5. Calculation Rules

This section defines the canonical algorithm. An implementation conformant with this section MUST produce identical numeric output for any valid document. The algorithm has six steps.

### 5.1 Arithmetic Requirements

All intermediate calculations MUST use arbitrary-precision decimal arithmetic with at least 50 significant digits. All rounding MUST use the half-up rule (round half away from zero toward positive infinity). Final values stored in the `totals` object are rounded to the number of decimal places defined by the document's currency according to ISO 4217 minor units: 0 for JPY, KRW, VND, and other zero-decimal currencies; 3 for KWD, BHD, OMR, TND, and other three-decimal currencies; 2 for all other currencies.

**Half-up rounding:** For a value `v` rounded to `d` decimal places: if the digit at position `d+1` is ≥ 5, round up; otherwise truncate.

**Example (VEC-11):** Item quantity = 3, unitPrice = 33.335. Gross = 3 × 33.335 = 100.005. Rounded half-up to 2 places = 100.01. (The digit at position 3 is 5, so round up.)

### 5.2 Step 1 — Line Calculations

For each item in `items`:

1. Compute `gross = roundHalfUp(quantity × unitPrice)`.
2. If `item.discount` is present, parse the discount (see Section 4.1) and compute `line_discount = applyDiscount(discount, gross)`. Otherwise `line_discount = 0`.
3. Set `item.amount = roundHalfUp(gross − line_discount)`.
4. If a tax configuration exists AND it is NOT compound mode:
   - Resolve the item's tax category (Section 3.5).
   - If the category is exempt or reverseCharge: set `item.taxAmount = 0`.
   - If the tax configuration is inclusive:
     - `net = roundHalfUp(item.amount / (1 + cat.rate / 100))`
     - `item.taxAmount = roundHalfUp(item.amount − net)`
   - Otherwise (exclusive, standard):
     - `item.taxAmount = roundHalfUp(item.amount × cat.rate / 100)`
5. If there is no tax configuration or the mode is compound: set `item.taxAmount = 0`.

Note: `item.taxAmount` computed in step 1 is a line-level informational value. Invoice-level tax totals are computed independently in Step 4.

### 5.3 Step 2 — Subtotal

```
subtotal = roundHalfUp(sum of item.amount for all items)
```

Summation MUST use an accumulator with arbitrary-precision arithmetic. Do not sum floating-point values directly.

### 5.4 Step 3 — Invoice-Level Discounts

Initialize `running = subtotal`. For each discount `d` in `document.discounts` (in declaration order):

1. `amount = applyDiscount(d, running)`
2. Append `{ label: d.label, amount }` to `discountDetails`.
3. `running = roundHalfUp(running − amount)`

After all discounts: `afterDiscounts = running`. `discountTotal = roundHalfUp(subtotal − afterDiscounts)`.

If `document.discounts` is absent or empty: `afterDiscounts = subtotal`, `discountTotal = 0`.

### 5.5 Step 4 — Tax Calculation

This step has three sub-cases based on the tax configuration.

**Sub-case A: No tax configuration**

`taxTotal = 0`. `withholdingTotal = 0`. `taxDetails` is empty.

**Sub-case B: Compound mode**

For each category `c` in the tax configuration (in declaration order):

```
catTax = roundHalfUp(afterDiscounts × c.rate / 100)
```

Append `{ category: c.id, label: c.label, rate: c.rate, base: afterDiscounts, amount: catTax, inclusive: false }` to `taxDetails`.

- If `c.withholding`: `withholdingTotal += catTax`
- Else if NOT `c.reverseCharge`: `taxTotal += catTax`

(Reverse charge categories in compound mode are recorded but excluded from both totals.)

After all categories: `taxTotal = roundHalfUp(taxTotal)`. `withholdingTotal = roundHalfUp(withholdingTotal)`.

**Sub-case C: Standard mode (exclusive or inclusive, non-compound)**

Separate categories into `regularCats` (where `withholding` is false or absent) and `withholdingCats` (where `withholding` is true).

For inclusive mode, `regularCats` includes all non-withholding categories.

**For each regular category `c` (in declaration order), with tie-breaking:**

```
linesInCat      = items where resolveCategory(item) == c
categoryNet     = roundHalfUp(sum of item.amount for linesInCat)
proportion      = categoryNet / subtotal   (0 if subtotal == 0)
allocatedDiscount = roundHalfUp(discountTotal × proportion)
```

For the LAST regular category, override the allocated discount:

```
allocatedDiscount = discountTotal − sum_of_all_prior_allocated_discounts
```

Then:

```
base = roundHalfUp(categoryNet − allocatedDiscount)
```

For **exclusive** mode:

```
catTax = c.exempt ? 0 : roundHalfUp(base × c.rate / 100)
```

Append `{ category: c.id, label: c.label, rate: c.rate, base, amount: catTax, inclusive: false }`.

If NOT `c.reverseCharge`: `taxTotal += catTax`.

For **inclusive** mode:

```
netBeforeTax = roundHalfUp(base / (1 + c.rate / 100))
catTax       = roundHalfUp(base − netBeforeTax)
```

Append `{ category: c.id, label: c.label, rate: c.rate, base: netBeforeTax, amount: catTax, inclusive: true }`.

If `c.withholding`:

```
withholdingTotal += catTax
```

Else if NOT `c.reverseCharge`: `taxTotal += catTax`.

**For each withholding category `c` (standard mode, non-compound):**

```
base   = afterDiscounts
catTax = roundHalfUp(base × c.rate / 100)
```

Append `{ category: c.id, label: c.label, rate: c.rate, base, amount: catTax, inclusive: false }`.

`withholdingTotal += catTax`.

After all categories: `taxTotal = roundHalfUp(taxTotal)`. `withholdingTotal = roundHalfUp(withholdingTotal)`.

### 5.6 Step 5 — Grand Total

```
if inclusive:
    total = afterDiscounts
else:
    total = roundHalfUp(afterDiscounts + taxTotal − withholdingTotal)
```

`inclusive` is true when the resolved tax configuration's `inclusive` flag is true.

### 5.7 Step 6 — Amount Due

```
prepaid   = document.prepaidAmount ?? 0
amountDue = roundHalfUp(total − prepaid)
```

`document.prepaidAmount` is the only prepaid input. A calculator MUST ignore a cached
`document.totals.prepaidAmount` along with every other derived `totals` field.

### 5.8 Complete Output

Return a Totals object with:

```
subtotal
discountDetails   (omit if empty)
afterDiscounts
taxDetails        (omit if empty)
taxTotal
withholdingTotal
total
prepaidAmount
amountDue
```

---

## 6. Style Model

### 6.1 Overview

The `style` field is an OPTIONAL object that instructs renderers how to present a document. It uses finite, renderer-neutral tokens and never contains authored CSS. The `style` field does NOT affect calculation.

### 6.2 Style Object

```typescript
interface InvoMLStyle {
  template?:   "standard" | "minimal" | "professional"
  dateFormat?: "iso" | "numeric" | "medium" | "long"
  order?:      string[]
  hidden?:     string[]
  blocks?:     Record<string, {
    span?: "full" | "half" | "one-third" | "two-thirds"
    align?: "start" | "center" | "end"
    breakBefore?: "page"
    breakAfter?: "page"
    keepTogether?: boolean
  }>
  pageFooter?: {
    show?:   boolean
    format?: string
  }
}
```

| Field | Type | Required | Purpose |
|---|---|---|---|
| `template` | string enum | OPTIONAL | Built-in visual template: `standard`, `minimal`, or `professional`. |
| `dateFormat` | string enum | OPTIONAL | Presentation preset for issue, due, and expiry dates: `iso` (default), `numeric`, `medium`, or `long`. |
| `order` | string[] | OPTIONAL | Explicit block rendering sequence. When present, the renderer MUST use exactly this sequence. When absent, the default order applies. |
| `hidden` | string[] | OPTIONAL | Elements to suppress from rendered output. Does not affect document data or calculation. See Section 6.8. |
| `blocks` | Record\<string, block tokens\> | OPTIONAL | Typed layout, alignment, pagination, and keep-together tokens. |
| `pageFooter` | object | OPTIONAL | Paged-media page footer intent. `show` defaults to true. `format` uses `{page}` and optional `{pages}` placeholders, max 120 chars. |

### 6.3 Block Ordering

#### 6.3.1 Default Order

When `style.order` is absent, the renderer MUST use this canonical sequence:

```
header → from → to → items → totals → [custom sections, sorted alphabetically] → payment → notes → paymentAdvice
```

Custom sections (keys from the `sections` map) are inserted alphabetically after `totals` and before `payment`. The reference implementation exposes this as `resolveOrder(doc)`.

#### 6.3.2 Explicit Order

When `style.order` is present, the renderer MUST use exactly that sequence:

- Blocks not listed in the array are NOT rendered (explicit exclusion).
- Blocks listed in the array whose data is absent are skipped with a presentation diagnostic.
- Missing `section:{key}` references are skipped with a presentation diagnostic.
- Blocks containing data but omitted from an explicit order are reported in diagnostics.

#### 6.3.3 Common Patterns

**Standard invoice (default order, no `style.order` needed):**
```json
"style": { "template": "standard" }
```

**Receipt (no `to`, no `payment`):**
```json
"style": {
  "order": ["header", "from", "items", "totals", "notes"]
}
```

**Credit note with reason section:**
```json
"style": {
  "order": ["header", "from", "to", "section:reason", "items", "totals", "notes"]
}
```

**Sections placed before items:**
```json
"style": {
  "template": "standard",
  "order": ["header", "from", "to", "section:scope", "items", "totals", "payment", "notes"]
}
```

### 6.4 Reserved Block Names

| Block name | Content source |
|---|---|
| `header` | `meta` fields: documentType, number, issueDate, dueDate, expiryDate, currency, reference |
| `from` | `from` party object |
| `to` | `to` party object |
| `items` | `items` array |
| `totals` | `totals` computed object |
| `payment` | `payment` object |
| `paymentAdvice` | Computed remittance advice enabled by the `paymentAdvice` object |
| `notes` | `notes` string |
| `section:{key}` | `sections[key]` object |

### 6.5 Well-Known Templates

All conforming implementations recognise exactly these templates:

| Template | Visual intent |
|---|---|
| `standard` | Clean, corporate. System sans-serif, normal spacing, subtle borders, left-aligned header. `from`/`to` rendered side-by-side by default. |
| `minimal` | Stripped back. Light typography, minimal borders, generous whitespace. |
| `professional` | Monochrome business document with strong rules, compact hierarchy, and deterministic tabular alignment. |

Template names are case-sensitive. Any other value is schema-invalid.

### 6.6 Block Presentation Tokens

Raw CSS, CSS property maps, and `style.properties` are schema-invalid. `style.blocks` accepts only:

- `span`: `full`, `half`, `one-third`, or `two-thirds`
- `align`: `start`, `center`, or `end`
- `breakBefore` / `breakAfter`: the literal `page`
- `keepTogether`: boolean

### 6.7 Per-Block Style

Keys MUST be built-in block names (Section 6.4) or `section:{key}`. Unknown keys and unknown token names/values are schema-invalid.

**Side-by-side party blocks:**
```json
"style": {
  "blocks": {
    "from": { "span": "half" },
    "to":   { "span": "half" }
  }
}
```

**Asymmetric widths:**
```json
"style": {
  "blocks": {
    "from": { "span": "two-thirds" },
    "to":   { "span": "one-third" }
  }
}
```

Blocks default to `span: "full"`, except the canonical consecutive `from` /
`to` pair defaults to `half` / `half` when both parties are present and neither
block has an authored span. HTML renderers group consecutive spans into
deterministic rows without reordering nodes; a span that would overflow starts
a new row. `breakBefore: "page"` and `breakAfter: "page"` force row boundaries
so paged-media declarations apply to the complete grid row. Markdown renders
sequentially and reports layout/pagination fallback diagnostics.

### 6.8 Element Suppression (`style.hidden`)

`style.hidden` is an OPTIONAL array of strings. Each entry names an element to suppress from rendered output. The document data MUST be preserved — `style.hidden` affects only rendered output, never document content or calculated values. A conformant renderer MUST NOT mutate the input document while applying `style.hidden`.

#### 6.8.1 Recognized Element Names

| Category | Valid names | Optional prefix |
|---|---|---|
| Item columns | `tax`, `unit`, `discount`, `quantity`, `unitPrice`, `description`, `amount` | `column:` |
| Blocks | `header`, `from`, `to`, `items`, `totals`, `payment`, `paymentAdvice`, `notes` | `block:` |
| Header meta | `dueDate`, `expiryDate`, `currency`, `reference`, `creditNoteReference` | `meta:` |
| Custom sections | (section key) | `section:` (REQUIRED) |

#### 6.8.2 Name Resolution

When a bare name (no prefix) appears in `style.hidden`, the renderer MUST resolve it by checking item column names first, then block names, then meta field names. The first match determines the category. When a prefix is present, it MUST be used directly without fallback resolution. Unrecognised entries SHOULD produce a validation warning but MUST NOT cause a rendering error.

Custom section entries MUST use the `section:` prefix. A bare section key is not a valid reference.

#### 6.8.3 Rendering Rule

A conformant renderer MUST NOT produce output for any element listed in `style.hidden`. This applies to the element in its entirety — block suppression omits the full block; column suppression omits the full column from the items table; meta suppression omits the field from the header block.

#### 6.8.4 Calculation and Extraction

`style.hidden` MUST NOT affect calculation. Calculators, validators, and data extractors MUST ignore it entirely. This is consistent with Section 1.3 (Data–Presentation Separation).

#### 6.8.5 Interaction with `style.order`

If a block name appears in both `style.order` and `style.hidden`, the renderer MUST suppress it. `style.hidden` takes precedence over `style.order`.

#### 6.8.6 Examples

```json
"style": {
  "hidden": ["tax"]
}
```
Suppresses the tax column from the items table. Tax data and calculations are unaffected.

```json
"style": {
  "hidden": ["payment", "notes", "dueDate"]
}
```
Suppresses the payment block, notes block, and due date field from the header.

```json
"style": {
  "hidden": ["column:description"]
}
```
Suppresses the description column using an explicit prefix for disambiguation.

### 6.9 Default Resolution

When `style` is absent or a field within it is absent:

| Field | Absent behaviour |
|---|---|
| `style` (entire object absent) | Renderer uses its own defaults. Default order applies. |
| `style.template` | `standard` |
| `style.order` | Default order (Section 6.3.1) is used. |
| `style.hidden` | No elements are suppressed. |
| `style.blocks` | Each block uses full span and target defaults. |

### 6.10 Validation Rules

A conformant validator MUST report the following as errors:

- `style.order` is present but empty (zero elements).
- `style.order` contains a value outside the built-in names or `section:{key}` pattern.
- `style.template` is not `standard`, `minimal`, or `professional`.
- `style.blocks` contains an unknown block key, token, or token value.
- `style.pageFooter.format` does not contain `{page}`.
- `style.pageFooter.format` exceeds 120 characters.
- `style.pageFooter.format` contains placeholders other than `{page}` and `{pages}`.
- `style.pageFooter.show` is not a boolean.
- `style.pageFooter` contains unknown keys.

A conformant validator SHOULD report the following as warnings:

- `style.hidden` contains an entry that does not resolve to any recognised element name (after prefix and bare-name resolution).

---

## 7. Serialization

### 7.1 Canonical JSON

The canonical serialization of an InvoML document is standard JSON (RFC 8259). An implementation MUST produce valid JSON. Key ordering is not normative; implementations MAY order keys in any way.

A compact JSON serialization (no insignificant whitespace) and a pretty-printed form (2-space indentation) are both conformant.

### 7.2 Markdown Serialization

An implementation SHOULD support a Markdown rendering of a document suitable for human reading and plain-text display. The Markdown rendering MUST follow the block order produced by `resolveOrder` (Section 6.3).

**Number formatting:** Numbers in Markdown output MUST use the currency's ISO 4217 decimal places.
Renderers SHOULD apply the deterministic number-format family resolved from `meta.locale`; when
`meta.locale` is absent or unsupported they MUST use the English convention (comma as thousands
separator, period as decimal separator). Examples: `7,200.00` (USD), `7,200` (JPY),
`7,200.000` (KWD).

**Header block:** Rendered as an H1 heading with document type and number. Dates and currency rendered as bold-label key-value pairs. `issueDate`, `dueDate`, and `expiryDate` use the `style.dateFormat` presentation preset.

**Party block:** Rendered as bold label (`**From:**` or `**To:**`) followed by the free-form `content`, or by structured fields. Structured `address.lines` are rendered in order, including explicit blank entries.

**Items block:** Rendered as a Markdown pipe table. Columns: Description, Quantity, [Unit if any item has unit], Unit Price, [Discount if any item has discount], Amount. All amounts formatted per the number formatting rule above.

**Totals block:** Rendered as a right-aligned two-column Markdown table. Rows: Subtotal; one row per discount detail (as negative); After Discounts (if discounts present); one row per tax detail; Withholding (as negative, if present); Total (bold, with currency code); Prepaid (as negative, if present); Amount Due (bold, if prepaid present).

**Payment block:** Rendered under an H3 heading "Payment". If `content` is present, rendered verbatim. Otherwise structured fields rendered as bold-label pairs.

**Notes block:** Rendered as an italic paragraph after a horizontal rule.

**Section block:** Rendered under an H3 heading matching `section.title`, followed by `section.content`.

**Block arrangement in Markdown:** Blocks render sequentially in resolved order. Every authored layout, alignment, pagination, or keep-together token produces a target-fallback diagnostic.

### 7.3 Locale-Aware Rendering (Reference Implementation)

The reference implementation (`invoml`) resolves BCP 47 tags to deterministic number
format families and semantic invoice labels. It ships labels for 20 locales, applies `lang` and
`dir` to HTML output, and marks Arabic and Hebrew as right-to-left. Unknown or malformed tags fall
back to English. Calculation remains locale-independent.

Canonical date values MUST remain ISO `YYYY-MM-DD` in the document and JSON serialization.
Renderers apply `style.dateFormat` only to presentation:

- `iso`: the canonical string, unchanged; this is the default.
- `numeric`: locale-appropriate numeric year, month, and day.
- `medium`: locale-appropriate abbreviated month with numeric day and year.
- `long`: locale-appropriate full month with numeric day and year.

Localized date formatting MUST use `meta.locale` and the UTC time zone so a calendar date cannot
shift with the renderer host's local time zone. Unknown or malformed locales MUST fall back to
English.

---

## 8. Error Conditions

### 8.1 Schema Errors

A document that does not conform to the JSON Schema (`invoml-v1.0.schema.json`) is invalid. A processor MUST reject it before calculation.

Schema errors include:
- `$invoml` is not `"1.0"`
- `meta.documentType` is not one of the five permitted values
- `meta.issueDate` or `meta.dueDate` does not match `YYYY-MM-DD`
- a party is empty, mixes `content` with structured fields, or uses newline-bearing address lines
- `style.dateFormat` is not one of `iso`, `numeric`, `medium`, or `long`
- `meta.currency` does not match `^[A-Z]{3}$`
- `items` is empty
- `documentType` is `"credit_note"` without `creditNoteReference`
- A discount `type` is not `"percentage"` or `"fixed"`
- A discount string does not match the pattern `^\d+(\.\d+)?(%?)$`
- A section key does not match `^[a-zA-Z0-9_-]+$`
- `style.order` is present but empty
- `style.order` references a section key that does not exist in `document.sections`

### 8.2 Calculation Errors

Calculation errors arise during Step 1 of the calculation algorithm. A calculator MUST raise an error and MUST NOT produce partial output for these conditions.

| Error code | Condition |
|---|---|
| `UNKNOWN_CATEGORY` | An item's `taxCategory` does not match any category `id` in the tax config (VEC-16) |
| `NO_DEFAULT_CATEGORY` | An item has no `taxCategory` and no category in the tax config has `default: true` (VEC-17) |

### 8.3 Error-Vector Format

Test vectors that represent error conditions use `{ "error": true }` as their expected output. A conformant implementation MUST produce a thrown error (exception, rejected promise, or equivalent) for these inputs, not a partial totals object.

---

## 9. Conformance

### 9.1 Conformant Document

A conformant InvoML document:

- MUST pass JSON Schema validation against `invoml-v1.0.schema.json`
- MUST have `$invoml` equal to `"1.0"`
- MUST have at least one item
- MUST include `creditNoteReference` when `documentType` is `"credit_note"`
- MUST NOT reference tax categories in items that are not declared in `meta.tax.categories`

### 9.2 Conformant Calculator

A conformant calculator:

- MUST implement the six-step algorithm defined in Section 5 (Calculation Rules)
- MUST use half-up rounding at every intermediate step
- MUST use arbitrary-precision decimal arithmetic for all intermediate values (minimum 50 significant digits)
- MUST apply proportional discount allocation with the last-category tie-breaking rule
- MUST produce `taxTotal`, `withholdingTotal`, `total`, and `amountDue` that match all 19 successful normative test vectors (vectors 01–15 and 18–21; vectors 16–17 are error cases)
- MUST raise an error for unknown tax categories and missing default categories
- MUST ignore every `totals` field in the input document, including cached `prepaidAmount`
- SHOULD produce `taxDetails` and `discountDetails` matching the expected output of test vectors where those fields are specified

### 9.3 Conformant Renderer

A conformant renderer:

- MUST accept a conformant document and produce output
- MUST respect the block order produced by `resolveOrder` (Section 6.3): use `style.order` when present, otherwise use the default order
- MUST render blocks in document order and report a diagnostic whenever a target cannot represent a presentation token
- MUST format numbers to the currency's ISO 4217 decimal places with thousands separators in Markdown output
- MUST NOT produce output for any element listed in `style.hidden` (Section 6.8)
- MUST ignore the `style` field entirely when computing totals or validating document data
- SHOULD NOT expose raw error messages or internal stack traces in rendered output

> A conformant renderer MUST NOT emit visible content that is not expressed in the document or resolved from document-expressed presentation intent (`style`, `meta.locale`). Paged-media furniture (page numbers, footers) MUST be driven exclusively by document-expressed intent resolved through this specification. Renderers MUST NOT invent defaults beyond the defaults this specification defines.

---

## 10. Test Vectors

### 10.1 Vector Format

Each test vector consists of two files:

- `{nn}-{name}.json` — the input InvoML document
- `{nn}-{name}.expected.json` — the expected output

The expected output is a subset of the `Totals` object. An implementation is considered conformant for a given vector when the computed totals contain at least the fields present in the expected output, with identical numeric values.

For error vectors, the expected output is `{ "error": true }`. The implementation MUST throw an error (not return a value) for these inputs.

### 10.2 Normative Vectors

The following 21 test vectors are normative. A conformant calculator MUST produce output matching each successful vector and MUST raise the specified error for each error vector.

| Vector | Name | What it tests |
|---|---|---|
| VEC-01 | minimal | No tax, single item, baseline |
| VEC-02 | basic-vat | Single-rate exclusive VAT |
| VEC-03 | multi-rate-eu | Multi-rate VAT with per-item category assignment |
| VEC-04 | invoice-discount-proportional | Proportional discount allocation across tax categories |
| VEC-05 | line-discounts | Per-line percentage discount |
| VEC-06 | cascading-discounts | Two sequential percentage discounts (cascading) |
| VEC-07 | compound-canada | Compound tax (GST + PST both applied to same base) |
| VEC-08 | inclusive-australia | Tax-inclusive pricing (GST backed out of line amount) |
| VEC-09 | reverse-charge | Reverse charge: tax recorded but excluded from total |
| VEC-10 | withholding | Withholding tax deducted from total |
| VEC-11 | rounding-edge | Half-up rounding at the line level |
| VEC-12 | zero-subtotal | All items zero-priced or cancelled out |
| VEC-13 | credit-note | Negative quantities producing negative totals |
| VEC-14 | inclusive-invoice-discount | Invoice-level discount with inclusive tax and proportional allocation |
| VEC-15 | compound-withholding | Compound tax with a withholding category |
| VEC-16 | error-unknown-category | UNKNOWN_CATEGORY error case |
| VEC-17 | error-no-default | NO_DEFAULT_CATEGORY error case |
| VEC-18 | proportional-tie-breaking | Three-category proportional allocation with rounding residual |
| VEC-19 | jpy-zero-decimal | JPY zero-decimal currency rounding |
| VEC-20 | kwd-three-decimal | KWD three-decimal currency rounding |
| VEC-21 | structured-party-localized-date | Structured and free-form parties with localized long-form dates |

### 10.3 Key Vector Details

**VEC-06 (cascading):** Demonstrates that the second invoice-level discount applies to the already-discounted running total, not the original subtotal. Subtotal 1000 → after 10% = 900 → after 5% of 900 = 855.

**VEC-07 (compound):** Demonstrates that in compound mode, item-level `taxCategory` is ignored and all categories apply to the same `afterDiscounts` base. GST 5% and PST 7% both applied to 1000.

**VEC-08 (inclusive):** Demonstrates inclusive price extraction. Grand total equals `afterDiscounts` regardless of tax amount.

**VEC-10 (withholding):** Demonstrates that withholding reduces the total. Formula: `total = afterDiscounts + taxTotal − withholdingTotal`.

**VEC-11 (rounding):** 3 × 33.335 = 100.005. Half-up rounds the digit 5 at the third decimal place up, giving 100.01.

**VEC-18 (tie-breaking):** Three equal-weight categories, fixed discount of 100. First two categories each get 33.33; last category absorbs residual 33.34 to ensure sum of bases equals afterDiscounts exactly.

**VEC-19 (JPY):** Uses a zero-decimal ISO 4217 currency. Line amounts, tax, and totals are rounded to whole yen.

**VEC-20 (KWD):** Uses a three-decimal ISO 4217 currency. Line amounts, tax, and totals retain three decimal places.

**VEC-21 (parties and dates):** Covers a structured issuer, a free-form recipient, the `en-SG` locale, and `style.dateFormat: "long"`. Its totals remain a normative calculator result; party and date fields also exercise document validation and rendering.
