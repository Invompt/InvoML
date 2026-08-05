# InvoML — Invoice Markup Language

**A specification for AI-generated invoice documents. Deterministic math, human-readable format, international tax coverage.**

[![npm version](https://img.shields.io/npm/v/invoml?style=flat-square)](https://www.npmjs.com/package/invoml)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/invompt/InvoML/ci.yml?style=flat-square)](https://github.com/invompt/InvoML/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat-square)](https://www.typescriptlang.org/)
[![test vectors](https://img.shields.io/badge/test_vectors-21-brightgreen?style=flat-square)](./test-vectors/)

InvoML is a **format specification** for invoice documents designed from the ground up for AI structured output and human authoring. `invoml` is the official TypeScript reference implementation.

---

## The Problem

Every time an AI model generates an invoice today, it faces the same dilemma: which format?

**Traditional business document formats were designed for enterprise systems, not AI.** They use verbose XML with deeply nested structures — a simple invoice can require hundreds of tokens of boilerplate before the first data field appears. They handle data exchange between machines but leave human presentation entirely to the renderer — with no way for the document to carry visual intent.

**The same invoice in InvoML:**

```json
{
  "$invoml": "1.0",
  "meta": { "documentType": "invoice", "number": "INV-2026-0001",
            "issueDate": "2026-03-28", "currency": "USD",
            "tax": { "label": "Tax", "rate": 10 } },
  "from": {
    "name": "EXAMPLE LANTERN WORKS",
    "address": { "lines": ["Sample business location", "Example City"] }
  },
  "to":   { "name": "EXAMPLE CLIENT WORKS" },
  "items": [
    { "description": "Archival storage crates", "quantity": 10, "unitPrice": 200.00 }
  ]
}
```

**Ad-hoc JSON doesn't solve it either:** totals are pre-calculated by the model (floating-point errors, hallucinated numbers), there is no validation contract, and renderers must guess at structure.

InvoML solves all three problems. It is compact enough for token-sensitive LLM calls, carries a JSON Schema for structured output APIs, and defines deterministic calculation rules that guarantee byte-identical totals across every runtime and language.

---

## How It Works

```
┌─────────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│                     │      │                       │      │                     │
│   AI generates      │ ───▶ │  Runtime calculates   │ ───▶ │  Renderer displays  │
│   InvoML document   │      │  all arithmetic       │      │  the final invoice  │
│                     │      │                       │      │                     │
│  data only, no      │      │  arbitrary-precision  │      │  HTML, email,       │
│  pre-computed sums  │      │  decimal math         │      │  Markdown, any UI   │
│                     │      │                       │      │                     │
└─────────────────────┘      └──────────────────────┘      └─────────────────────┘
```

The spec separates three responsibilities that every other format conflates:

1. **Data** — what the invoice says (items, parties, tax rates, discounts)
2. **Math** — deterministic rules the runtime always executes (subtotals, rounding, tax cascades)
3. **Presentation** — how it looks. The optional `style` field carries block order, built-in templates, visibility, typed layout/alignment tokens, and paged-media intent without authored CSS.

AI models only produce layer 1. The runtime owns layer 2. Renderers own layer 3.

---

## Quick Example

A minimal invoice with a single line and 10% VAT:

```json
{
  "$invoml": "1.0",
  "meta": {
    "documentType": "invoice",
    "number": "INV-001",
    "issueDate": "2026-03-28",
    "currency": "EUR",
    "tax": { "label": "VAT", "rate": 10 }
  },
  "from": { "content": "**EXAMPLE STUDIO WORKS**\nSample business location\nGermany" },
  "to":   { "content": "**EXAMPLE CLIENT WORKS**\nSample recipient location\nGermany" },
  "items": [
    { "description": "Counter display rack", "quantity": 1, "unitPrice": 1200.00 }
  ]
}
```

The runtime calculates:

| Field        | Value     |
|--------------|-----------|
| Subtotal     | €1,200.00 |
| VAT (10%)    | €120.00   |
| **Total**    | **€1,320.00** |

Numbers are computed from spec rules, never guessed by the model.

### With visual intent

The same invoice, with the AI expressing how it should look:

```json
{
  "$invoml": "1.0",
  "meta": {
    "documentType": "invoice",
    "number": "INV-001",
    "issueDate": "2026-03-28",
    "currency": "EUR",
    "tax": { "label": "VAT", "rate": 10 }
  },
  "from": { "content": "**EXAMPLE STUDIO WORKS**\nSample business location\nGermany" },
  "to":   { "content": "**EXAMPLE CLIENT WORKS**\nSample recipient location\nGermany" },
  "items": [
    { "description": "Counter display rack", "quantity": 1, "unitPrice": 1200.00 }
  ],
  "style": {
    "template": "minimal",
    "blocks": {
      "header": { "align": "center" },
      "from": { "span": "two-thirds" },
      "to": { "span": "one-third" }
    }
  }
}
```

The `style` object uses finite renderer-neutral tokens for alignment and layout. Raw CSS is never document-authored InvoML. Without `style`, the renderer applies its own defaults.

---

## Reference Implementation

`invoml` is the official TypeScript implementation of the InvoML v1.0 specification.

### Development availability

This candidate is for source development and validation. It does not make a public registry,
production, or installation claim. When an owner-authorized development channel is available, use
`@next`; do not substitute `latest` or infer a release from this README.

### Parse and validate

```typescript
import { parse, calculate, toMarkdown } from 'invoml'

const result = parse(jsonString)
if (!result.success) {
  console.error(result.errors)
  process.exit(1)
}
```

### Calculate totals

```typescript
const totals = calculate(result.document)

console.log(totals.subtotal)   // 1200
console.log(totals.taxTotal)   // 120
console.log(totals.total)      // 1320
console.log(totals.amountDue)  // 1320
```

All arithmetic uses arbitrary-precision decimal math (`decimal.js`). No floating-point rounding errors. Results are byte-identical across Node.js versions and operating systems.

### Render to Markdown

```typescript
// Attach totals to the document, then render
const doc = { ...result.document, totals }
const md = toMarkdown(doc)
// Ready for chat interfaces, email previews, plain-text pipelines
```

### API surface

| Function | Description |
|---|---|
| `parse(json)` | Parse and type-validate a JSON string into `InvoMLDocument` |
| `calculate(doc)` | Compute all totals with arbitrary-precision math |
| `validate(doc)` | Run domain validation rules — returns errors and warnings |
| `validateSchema(value)` | Validate against the JSON Schema (useful before `parse`) |
| `toJSON(doc, options?)` | Serialize to JSON; refreshes computed line fields before output and refreshes totals when `doc.totals` is present. Pass `{ compact: true }` for minified output |
| `toMarkdown(doc)` | Render as a human-readable Markdown table (reads `doc.totals`) |
| `toHTML(doc, options?)` | Render as HTML — full document or embeddable fragment |
| `renderMarkdown(doc)` | Render Markdown and return `{ output, diagnostics }` |
| `renderHTML(doc, options?)` | Render HTML and return `{ output, diagnostics }` |
| `resolvePresentation(doc, target, options?)` | Shared resolver for HTML or Markdown |
| `validateStyle(style, sectionNames?)` | Validate a style object against normative rules |
| `resolveOrder(doc)` | Resolve effective block rendering order for a document |
| `resolveStyle(doc)` | Resolve the full style object with defaults applied |
| `resolvePageFooter(doc)` | Resolve `{ show, format }` from document style and locale defaults |
| `setSchema(schema)` | Inject the JSON Schema directly (required for browser/edge runtimes) |
| `applyDiscount(doc, discount)` | Add an invoice-level discount, returns new doc + totals |
| `removeDiscounts(doc)` | Remove all invoice-level discounts, returns new doc + totals |
| `applyTax(doc, tax)` | Set the document-level tax configuration, returns new doc + totals |
| `removeTax(doc)` | Remove document-level tax, returns new doc + totals |
| `fmtNum(n, dp, opts?)` | Locale-aware number formatter (deterministic, no `Intl` dependency) |
| `resolveNumberFormat(locale?)` | Resolve format options from a BCP 47 locale tag |
| `formatDate(value, locale?, preset?)` | Present a canonical ISO date using `iso`, `numeric`, `medium`, or `long` |
| `getCurrencyDecimals(currency)` | Return the decimal precision for an ISO 4217 currency code |

**Constants:**

| Constant | Value | Description |
|---|---|---|
| `DEFAULT_ORDER` | `['header', 'from', 'to', 'items', 'totals', 'payment', 'notes', 'paymentAdvice']` | Canonical block rendering order |
| `RESERVED_BLOCK_NAMES` | same values | Built-in block names recognised by the renderer |
| `TEMPLATE_NAMES` | `['standard', 'minimal', 'professional']` | Valid document-authored templates |
| `DATE_FORMAT_PRESETS` | `['iso', 'numeric', 'medium', 'long']` | Supported date presentation presets |

### Browser / Edge Runtime Usage

The default validator loads the JSON Schema from the filesystem (Node.js only). For browser or edge runtimes, inject the schema manually:

```typescript
import { setSchema, parse, calculate } from 'invoml'
import schema from 'invoml/invoml-v1.0.schema.json'

setSchema(schema)
// Now parse() and validateSchema() work without filesystem access
```

### HTML rendering options

`toHTML()` accepts an optional `RenderOptions` object:

```typescript
import { toHTML } from 'invoml'

// Full self-contained document (default)
const html = toHTML(doc)

// Embeddable fragment — <style> + <div> only, no DOCTYPE/html/head/body wrapper
const fragment = toHTML(doc, { fragment: true })

// Editable mode — adds contenteditable="true" and aria-label to all data fields
// Computed fields (amounts, taxes) get contenteditable="false"
const editable = toHTML(doc, { editable: true })
```

| Option | Type | Description |
|---|---|---|
| `fragment` | `boolean` | Return `<style>` + `<div>` without the outer HTML document wrapper |
| `editable` | `boolean` | Add `contenteditable` and `aria-label` to all data fields; computed fields locked to `false` |
| `theme` | `string \| InvoMLTheme` | Theme preset name or inline theme object (see Themes below) |
| `customCss` | `string` | Raw CSS appended as the final style layer (wins the cascade). Trusted input only |

Block Markdown fields (`from.content`, `to.content`, `payment.content`,
`sections.*.content`, and `notes`) support bold, italic, underline, links,
bullet and numbered lists, and ATX headings levels 1–3. Use separate titled
sections for peer invoice blocks; use `###` headings for subordinate groups
inside a titled section.

### Themes

Runtime theme presets set trusted container CSS custom properties (colors, fonts, density). `customCss` remains trusted runtime input and wins the cascade; neither is document-authored InvoML:

```typescript
import { toHTML, THEME_PRESETS, resolveTheme } from 'invoml'

const html = toHTML(doc, { theme: 'ember' })
const custom = toHTML(doc, {
  theme: { accent: '#0f766e', fontHeading: 'Georgia, serif', density: 'spacious' },
  customCss: '.invoml-header { border-bottom: 4px double currentColor; }',
})
```

| Preset | Look |
|---|---|
| `standard` | Neutral slate accent, system fonts |
| `slate` | Cool gray-blue, muted corporate |
| `ember` | Warm orange accent on stone neutrals |
| `forest` | Green accent, natural palette |
| `violet` | Purple accent, indigo text |
| `mono` | Monospace fonts, black accent, compact density |
| `editorial` | Serif headings, crimson accent, spacious density |

`InvoMLTheme` fields: `accent`, `text`, `muted`, `border`, `background`, `fontHeading`, `fontBody`, `density` (`compact` \| `normal` \| `spacious`). All optional and serializable.

### Domain validation

Two independent validators with different scopes:

- **`validateSchema(value)`** — structural. Checks a raw value against the JSON Schema. Use on raw AI output *before* calling `parse`.
- **`validate(doc)`** — domain. Checks business logic rules on a parsed `InvoMLDocument`. Returns both errors and warnings.

```typescript
import { parse, validate, validateSchema } from 'invoml'

// Step 1: structural check on raw AI output
const schemaResult = validateSchema(rawAIOutput)
if (!schemaResult.valid) {
  console.error(schemaResult.errors)
}

// Step 2: parse
const { document } = parse(JSON.stringify(rawAIOutput))

// Step 3: domain rules
const { valid, issues } = validate(document)
for (const issue of issues) {
  console.log(`[${issue.level}] ${issue.path}: ${issue.message}`)
}
```

**Errors** — `valid: false`, must be fixed before calculating:

| Code | Path | Rule |
|---|---|---|
| `EMPTY_NUMBER` | `meta.number` | Document number is empty or whitespace-only |
| `INVALID_CURRENCY` | `meta.currency` | Not a recognised ISO 4217 currency code |
| `EMPTY_ITEMS` | `items` | Items array has zero entries |
| `NON_POSITIVE_QUANTITY` | `items[n].quantity` | Item quantity is ≤ 0 |
| `NEGATIVE_UNIT_PRICE` | `items[n].unitPrice` | Item unit price is negative |

**Warnings** — `valid: true`, calculation still proceeds:

| Code | Path | Rule |
|---|---|---|
| `DUE_BEFORE_ISSUE` | `meta.dueDate` | Due date is before issue date |
| `ISSUE_DATE_TOO_OLD` | `meta.issueDate` | Issue date is more than 1 year in the past |
| `ISSUE_DATE_FUTURE` | `meta.issueDate` | Issue date is more than 1 year in the future |
| `DUPLICATE_DESCRIPTION` | `items[n].description` | Duplicate item description (case-insensitive) |
| `LARGE_TOTAL` | `items` | Calculated total exceeds 10,000,000 |

Each issue carries a `level`, `path`, `code`, and `message` string.

### Locale and number formatting

Set `meta.locale` to a BCP 47 locale tag and the renderer formats all numbers accordingly. The library uses five deterministic format families — no `Intl.NumberFormat` dependency.

| Family | Thousands | Decimal | Grouping | Locales (examples) |
|---|---|---|---|---|
| EN | `,` | `.` | Standard (groups of 3) | `en`, `ja`, `ko`, `zh` |
| DE | `.` | `,` | Standard | `de`, `es`, `pt`, `it`, `nl`, `tr` |
| CH | `'` | `.` | Standard | `de-CH`, `fr-CH`, `it-CH` |
| IN | `,` | `.` | Indian (3 then 2s) | `hi`, `mr`, `bn`, `en-IN` |
| SPACE | `\u202F` (narrow no-break) | `,` | Standard | `fr`, `fr-FR`, `sv`, `nb`, `fi`, `pl`, `cs` |

```typescript
import { fmtNum, resolveNumberFormat } from 'invoml'

const opts = resolveNumberFormat('de-DE')
fmtNum(1234567.89, 2, opts)  // "1.234.567,89"

const chOpts = resolveNumberFormat('fr-CH')
fmtNum(1234567.89, 2, chOpts)  // "1'234'567.89"
```

`resolveNumberFormat` falls back to EN for unrecognised tags. Exact-match overrides (`de-CH`, `fr-FR`, `en-IN`) take precedence over prefix matching.

### Parties, addresses, and date presentation

A party uses exactly one representation:

```json
{ "content": "**EXAMPLE SELLER**\nSample business location\nSingapore" }
```

or structured fields:

```json
{
  "name": "EXAMPLE SELLER",
  "address": {
    "lines": ["Sample business location", "Singapore"]
  },
  "email": "billing@party.example.invalid"
}
```

Do not combine `content` with structured fields. Structured address lines cannot contain CR or LF;
use one array entry per line. Empty entries are preserved as intentional blank lines.

Source dates always remain ISO `YYYY-MM-DD`. To localize only their presentation, set a finite
style preset:

```json
{
  "meta": { "issueDate": "2024-02-29", "locale": "en-SG" },
  "style": { "dateFormat": "long" }
}
```

The rendered date is `29 February 2024`; `toJSON()` still serializes `2024-02-29`. Date formatting
uses the requested BCP 47 locale and UTC. The default `iso` preset preserves existing output.

### Mutators

Mutators apply non-destructive changes and return a new document with recalculated totals. The input is never mutated (`structuredClone` is used internally).

```typescript
import { applyDiscount, removeDiscounts, applyTax, removeTax } from 'invoml'

// Add an invoice-level percentage discount
const { document: discounted, totals } = applyDiscount(doc, {
  type: 'percentage',
  value: 10,
  label: 'Early payment'
})

// Add a fixed-amount discount
const { document: fixed } = applyDiscount(doc, { type: 'fixed', value: 50 })

// Remove all invoice-level discounts
const { document: noDiscounts } = removeDiscounts(discounted)

// Set (or replace) the document-level tax — simple form only
const { document: taxed } = applyTax(doc, { rate: 20, label: 'VAT', inclusive: false })

// Remove document-level tax entirely
const { document: noTax } = removeTax(taxed)
```

All mutators return `MutationResult`:

```typescript
interface MutationResult {
  document: InvoMLDocument  // new document with change applied
  totals: InvoMLTotals      // recalculated totals
}
```

These mutators operate on **invoice-level** discounts and the **document-level simple tax**. Line-level discounts on individual items are set directly on `items[n].discount`.

### Subpath exports

Import individual modules to tree-shake or avoid unwanted dependencies:

| Subpath | What it provides | Browser-safe |
|---|---|---|
| `invoml` | All exports (main entry) | ✓ (call `setSchema` first) |
| `invoml/calculator` | `calculate`, `CalculationError` | ✓ |
| `invoml/html-renderer` | `toHTML`, `RenderOptions` | ✓ |
| `invoml/html-css` | `BASE_CSS`, `TEMPLATE_CSS` raw CSS strings | ✓ |
| `invoml/presentation` | `resolvePresentation`, diagnostics and result types | ✓ |
| `invoml/types` | All TypeScript types, no runtime code | ✓ |
| `invoml/validator` | `validateSchema`, `setSchema`, `ValidationResult` | ✓ (call `setSchema` first) |
| `invoml/validation` | `validate`, `ValidationIssue`, `DomainValidationResult` | ✓ |
| `invoml/mutators` | `applyDiscount`, `removeDiscounts`, `applyTax`, `removeTax`, `MutationResult` | ✓ |
| `invoml/format` | `fmtNum`, `resolveNumberFormat`, `NumberFormatOptions` | ✓ |
| `invoml/themes` | `THEME_PRESETS`, `resolveTheme`, `InvoMLTheme` | ✓ |
| `invoml/invoml-v1.0.schema.json` | Raw JSON Schema (for `setSchema`, LLM structured output) | ✓ |

The `/validator` subpath exists specifically so you can import `validateSchema` in isolation without pulling in the full bundle. In Node.js it loads the schema from the filesystem on first call; in browsers/edge runtimes, call `setSchema(schema)` before any validation.

---

## Ecosystem

### JSON Schema for LLM structured output

The InvoML v1.0 JSON Schema is at [`invoml-v1.0.schema.json`](./invoml-v1.0.schema.json). Pass it directly to any LLM structured-output API:

```typescript
import schema from 'invoml/invoml-v1.0.schema.json' with { type: 'json' }

// OpenAI structured outputs
const completion = await openai.beta.chat.completions.parse({
  model: 'gpt-4o',
  response_format: { type: 'json_schema', json_schema: { schema } },
  messages: [{ role: 'user', content: 'Generate an invoice for ...' }]
})

// Anthropic tool use
const message = await anthropic.messages.create({
  tools: [{ name: 'generate_invoice', input_schema: schema }],
  // ...
})
```

### CLI

From the authorized source checkout prepared above:

```bash
# Validate a document against the schema and domain rules
npm run cli -- validate invoice.json

# Calculate and print totals
npm run cli -- calculate invoice.json

# Serialize to canonical JSON with computed totals
npm run cli -- serialize invoice.json

# Render as a self-contained HTML file
npm run cli -- html invoice.json > invoice.html

# Theme and custom CSS work for HTML
npm run cli -- html invoice.json --theme slate --custom-css brand.css > invoice.html
```

For owner-authorized development-channel validation, the equivalent package CLI may use
`npx invoml@next ...`.

### Test vectors for conformance

The [`test-vectors/`](./test-vectors/) directory contains 21 canonical input/expected pairs. Any implementation claiming InvoML v1.0 conformance must pass all 21 vectors.

| # | Scenario |
|---|---|
| 01 | Minimal invoice (no tax) |
| 02 | Basic VAT |
| 03 | Multi-rate EU VAT |
| 04 | Invoice-level proportional discount |
| 05 | Line-level discounts |
| 06 | Cascading discounts |
| 07 | Compound tax (Canada GST + PST) |
| 08 | Inclusive tax (Australia GST) |
| 09 | Reverse charge (zero-rate VAT) |
| 10 | Withholding tax |
| 11 | Rounding edge case |
| 12 | Zero subtotal |
| 13 | Credit note |
| 14 | Inclusive tax with invoice-level discount |
| 15 | Compound withholding |
| 16 | Error — unknown tax category |
| 17 | Error — no default tax |
| 18 | Proportional discount tie-breaking |
| 19 | JPY zero-decimal currency (Japan Consumption Tax) |
| 20 | KWD three-decimal currency (Kuwait VAT) |

---

## International Coverage

InvoML covers 15+ countries out of the box. The [`examples/`](./examples/) directory contains real-world documents for:

**Tax models supported:**
- Flat-rate VAT/GST (UK, EU, UAE, Switzerland, Singapore, Australia)
- Multi-rate VAT (EU — standard 19%/7%, zero-rate, exempt within the same document)
- Compound taxes (Canada — GST + PST calculated on different bases)
- Inclusive taxes (Australia GST — tax embedded in the listed price)
- Reverse charge (EU cross-border — tax shifts to buyer)
- Withholding taxes (Nigeria, Mexico — issuer reports, buyer remits)
- CFDI-compatible (Mexico IVA with SAT registration fields)
- ZUGFeRD-compatible field coverage (Germany)
- IGST/CGST/SGST model (India)
- Consumption tax (Japan 10%)

**Document types:** invoices, quotes, estimates, receipts, credit notes

---

## For AI Developers

Building an invoice generation feature? See [`docs/LLM-INTEGRATION.md`](./docs/LLM-INTEGRATION.md) for:

- How to pass the InvoML schema to structured output APIs (OpenAI, Anthropic, Google)
- System prompt patterns that produce valid InvoML reliably
- How to validate AI output before calling `calculate`
- Handling edge cases: unknown tax categories, missing currency symbols, model hallucinations

---

## Specification

The InvoML v1.0 specification (currently Draft) lives in [`SPEC.md`](./SPEC.md). It defines:

- Document structure and required fields
- Tax resolution rules (simple, full, compound, inclusive, withholding, reverse charge)
- Discount application order (line-level before invoice-level, proportional allocation)
- Rounding rules (half-up, currency-precision)
- Style model: block ordering, named templates, visibility, typed spans/alignment, and paged-media tokens
- Conformance requirements for independent implementations

The `invoml` reference implementation is normative for any case where the spec text is ambiguous. If `invoml` and `SPEC.md` disagree, file an issue — both will be corrected.

---

## Why InvoML?

Existing invoice standards were built for enterprise systems — they handle data exchange between machines but say nothing about how the document should look. Ad-hoc JSON handles neither reliably. InvoML covers the full pipeline: AI generates structured data with optional visual intent, the runtime computes deterministic totals, and renderers produce polished output for humans.

See [`docs/WHY-INVOML.md`](./docs/WHY-INVOML.md) for a detailed comparison with UBL, ad-hoc JSON, and platform-specific formats.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, test vector authoring, and the pull request process.
The short verification loop is `npm run build`, `npm test`, and `npm run test:functional` when you want the focused document-level regression suite.

Implementations in other languages are welcome. Any implementation that passes all 21 test vectors and implements the arithmetic rules in `SPEC.md` is a conforming InvoML v1.0 implementation.

---

## License

Apache-2.0 — see [LICENSE](./LICENSE)
