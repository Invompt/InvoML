# InvoML LLM Integration Guide

How to use InvoML with the OpenAI, Anthropic, and Google structured-output APIs.

The three complete examples below are mirrored in `examples/llm-providers/` and typechecked against
the pinned provider SDKs by `npm test`. Documentation tests fail if either copy drifts.

---

## Concept

InvoML separates what the AI generates from what the runtime computes. The AI fills in the document structure — parties, line items, descriptions, dates, tax configuration. The runtime handles all arithmetic deterministically using arbitrary-precision decimal math.

This means:

- **The AI never calculates totals.** It never computes `quantity * unitPrice`, applies a discount, or sums a tax. It just describes the transaction.
- **The runtime is the single source of truth for numbers.** Every subtotal, tax amount, and total is produced by `calculate()`, not by the model.
- **Results are reproducible.** Conforming runtimes apply the same decimal and rounding rules to the same input document.

The practical implication: the InvoML JSON Schema is the runtime contract, while each LLM provider supports a different JSON Schema subset. Ask the model for JSON, then pipe the untrusted result through `parse()` → `validate()` → `calculate()` → `toJSON()` / `toMarkdown()`. Never treat provider-side structured output as a substitute for full InvoML validation.

---

## The JSON Schema

The InvoML v1.0 JSON Schema lives at the package root and is the machine-readable contract between your application and the LLM.

```typescript
import schema from 'invoml/invoml-v1.0.schema.json' with { type: 'json' }
// Node.js 18-20: use 'assert' instead of 'with'
```

### What the AI fills in

| Field | Description |
|---|---|
| `$invoml` | Always `"1.0"` — the AI must include this |
| `meta.documentType` | `"invoice"`, `"quote"`, `"credit_note"`, `"receipt"`, or `"estimate"` |
| `meta.number` | Document number string, e.g. `"INV-2026-001"` |
| `meta.issueDate` | ISO date string `"YYYY-MM-DD"` |
| `meta.dueDate` | ISO date string, optional |
| `meta.currency` | Three-letter ISO code, e.g. `"USD"`, `"EUR"`, `"MXN"` |
| `meta.locale` | BCP 47 locale, e.g. `"en-US"`, `"es-MX"` — optional |
| `meta.tax` | Simple `{ label, rate }` or full `{ categories: [...] }` — optional |
| `from` / `to` | Seller and buyer party objects — optional but strongly recommended |
| `items[]` | Line items: `description`, `quantity`, `unitPrice`, optional `unit`, `discount`, `taxCategory` |
| `discounts[]` | Invoice-level discounts: `type`, `value`, optional `label` |
| `payment` | Payment instructions — optional |
| `sections` | Custom named sections — optional |
| `notes` | Free-text footer — optional |
| `prepaidAmount` | Amount already paid or deposited; the runtime deducts it from `total` to produce `amountDue` — optional |
| `style` | Visual presentation hints — optional; see Style and Ordering below |

### What the runtime computes (AI must NOT fill these in)

| Field | Description |
|---|---|
| `items[].amount` | `quantity × unitPrice` after line discount |
| `items[].taxAmount` | Tax on the line amount |
| `totals.subtotal` | Sum of all line amounts |
| `totals.afterDiscounts` | Subtotal after invoice-level discounts |
| `totals.taxDetails` | Per-category tax breakdowns |
| `totals.taxTotal` | Sum of all taxes |
| `totals.withholdingTotal` | Sum of withholding taxes |
| `totals.total` | Grand total |
| `totals.amountDue` | Total minus any prepaid amount |

If the AI emits `totals` or pre-filled `amount`/`taxAmount` values, the runtime recalculates them from the source fields. `calculate()` ignores cached derived values, and the canonical serializers/renderers refresh them on a working copy before output. This is safe — it is the expected behavior.

### Style and Ordering

The `style` field gives presentation hints to renderers. It does not affect calculation. The AI may omit it entirely for standard invoices — the runtime applies a sensible default order automatically.

**When to omit `style`:** For a standard invoice, omit `style` entirely. The renderer uses the default order: `header → from → to → items → totals → payment → notes → paymentAdvice`; absent optional data is diagnosed and skipped.

**When to add a template:** When the user requests a named visual style, set `style.template`:
```json
"style": { "template": "standard" }
```
Canonical named templates are exactly `"standard"`, `"minimal"`, and `"professional"`.
Unknown names are schema-invalid.

**When custom sections need explicit placement:** If the document has a `sections` map, entries are placed after `totals` by default. When a section should appear before items (e.g., a scope section before the line items), use `style.order`:
```json
"style": {
  "template": "standard",
  "order": ["header", "from", "to", "section:scope", "items", "totals", "payment", "notes"]
}
```
**Important:** Without `style.order`, custom sections render after totals in alphabetical order. When an explicit `style.order` is present, a section must appear in both `sections` (as data) and `style.order` (as a rendering instruction); an omitted section is intentionally not rendered.

**Receipt pattern:** Omit `to` and `payment` from the order:
```json
"style": {
  "order": ["header", "from", "items", "totals", "notes"]
}
```

**Credit note pattern:** Omit `payment`, add a `section:reason` block:
```json
"style": {
  "order": ["header", "from", "to", "section:reason", "items", "totals", "notes"]
}
```

**Presentation:** Use a built-in template and finite `style.blocks` tokens. Never author CSS:
```json
"style": {
  "template": "minimal",
  "blocks": {
    "header": { "align": "center" },
    "from": { "span": "two-thirds" },
    "to":   { "span": "one-third" }
  }
}
```

---

## OpenAI Responses API

OpenAI strict Structured Outputs cannot accept the complete InvoML schema unchanged. OpenAI's strict subset requires every object property to be required and does not support keywords such as `if`, `then`, and `else`; InvoML intentionally has optional fields and conditional validation. Use JSON mode to obtain a JSON object, then enforce the complete contract with `parse()` and `validate()`.

### Install

```bash
npm install openai invoml@next
```

The pinned `openai@7.4.0` example requires Node.js 22 or newer. This repository verifies it on
Node.js 22.22.0; the `invoml` package by itself retains Node.js 18 consumer support.

### Complete example

```typescript
import OpenAI from 'openai'
import { parse, validate, calculate, toMarkdown } from 'invoml'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const model = requireEnv('OPENAI_MODEL')

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Set ${name} to a currently supported model`)
  return value
}

const SYSTEM_PROMPT = `You are an invoice generation assistant. Given a description of a transaction,
produce an InvoML v1.0 document as a JSON object.

Rules:
- Set "$invoml" to "1.0" — always required
- Never calculate totals, subtotals, or tax amounts — leave items[].amount, items[].taxAmount,
  and the entire "totals" object out of your response
- Set currency as a three-letter ISO 4217 code (USD, EUR, GBP, MXN, etc.)
- Set issueDate as YYYY-MM-DD
- Set documentType to invoice, quote, credit_note, receipt, or estimate; include
  creditNoteReference when documentType is credit_note
- If tax applies, declare it in meta.tax using a simple { label, rate } for single-rate tax,
  or { categories: [...] } for multi-rate tax
- When using multi-rate tax, set taxCategory on each line item matching the category id
- Use the "from" party for the seller, "to" for the buyer
- Discounts go in items[].discount (line-level) or discounts[] (invoice-level), never as negative line items
- Omit optional fields entirely when they have no value — never use null or empty strings
- Style block names must be exact: "from", "to" (not "parties"), "section:scope" (not "scope")
- The "content" field on from/to is the actual display text with Markdown formatting, not the word "markdown"`

async function generateInvoice(userRequest: string): Promise<string> {
  const response = await client.responses.create({
    model,
    input: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userRequest },
    ],
    text: {
      format: { type: 'json_object' },
    },
  })

  const raw = response.output_text
  if (!raw) throw new Error('Empty response from OpenAI')

  // Parse and apply domain validation before calculation
  const parsed = parse(raw)
  if (!parsed.success) {
    throw new Error(`InvoML parse error: ${parsed.errors.join(', ')}`)
  }

  const validation = validate(parsed.document)
  const fatalIssues = validation.issues
    .filter(issue => issue.level === 'error')
    .map(issue => `${issue.code}: ${issue.message}`)
  if (fatalIssues.length > 0) {
    throw new Error(`InvoML validation error(s): ${fatalIssues.join('; ')}`)
  }

  // Compute all totals deterministically
  const totals = calculate(parsed.document)

  // Render to Markdown
  return toMarkdown({ ...parsed.document, totals })
}

// Usage
const markdown = await generateInvoice(
  'Create an invoice from FICTIONAL SAMPLE LANTERN PAPER CO to FICTIONAL SAMPLE AMBER MARKET CO for 10 cartons of archival folders at $200 per carton. ' +
  'Add 8.25% sales tax. Due in 30 days.'
)
console.log(markdown)
```

### Notes on the OpenAI Responses API

- JSON mode guarantees syntactically valid JSON, not a valid InvoML document. `parse()` and `validate()` remain mandatory.
- Do not pass the complete InvoML schema to OpenAI with `strict: true`. Build and maintain a provider-specific strict schema only if your application needs that extra constraint, and still validate against InvoML afterward.
- Keep the model identifier in configuration and verify it against the current OpenAI model catalog before deployment.
- See OpenAI's current [Structured Outputs schema rules](https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas) and [JSON mode guidance](https://developers.openai.com/api/docs/guides/structured-outputs#json-mode).

---

## Anthropic Tool Use

Claude does not have a `response_format` parameter. Instead, you define an InvoML tool with the schema as `input_schema` and use `tool_choice` to force the model to call it. The tool call input becomes your InvoML document.

### Install

```bash
npm install @anthropic-ai/sdk invoml@next
```

Run this typechecked provider example on the repository runtime, Node.js 22.22.0. The `invoml`
package by itself retains Node.js 18 consumer support; provider SDK support is a separate contract.

### Complete example

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { parse, validate, calculate, toMarkdown } from 'invoml'
import schema from 'invoml/invoml-v1.0.schema.json' with { type: 'json' }
// Node.js 18-20: use 'assert' instead of 'with'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const model = requireEnv('ANTHROPIC_MODEL')
const inputSchema = schema as Anthropic.Tool.InputSchema

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Set ${name} to a currently supported model`)
  return value
}

const SYSTEM_PROMPT = `You are an invoice generation assistant. When the user describes a transaction,
call the generate_invoml tool to produce a valid InvoML v1.0 document.

Rules:
- Set "$invoml" to "1.0" — always required
- Never pre-calculate totals, subtotals, or tax amounts — omit items[].amount, items[].taxAmount,
  and the entire "totals" object
- Set currency as a three-letter ISO 4217 code (USD, EUR, GBP, MXN, etc.)
- Set issueDate as YYYY-MM-DD
- Set documentType to invoice, quote, credit_note, receipt, or estimate; include
  creditNoteReference when documentType is credit_note
- If tax applies, declare it in meta.tax: use { label, rate } for single-rate,
  or { categories: [...] } for multi-rate
- When using multi-rate tax, assign taxCategory on each line item to match the category id
- Use the "from" party for the seller, "to" for the buyer
- Line-level discounts go in items[].discount; invoice-level discounts go in discounts[]
- Never use negative unit prices to represent discounts
- Omit optional fields entirely when they have no value — never use null or empty strings
- Style block names must be exact: "from", "to" (not "parties"), "section:scope" (not "scope")
- The "content" field on from/to is the actual display text with Markdown formatting, not the word "markdown"`

async function generateInvoice(userRequest: string): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: 'generate_invoml',
        description:
          'Generate a structured InvoML v1.0 invoice document based on the transaction details ' +
          'provided by the user. Call this tool with a complete InvoML document — do not calculate ' +
          'totals or tax amounts, as those are computed by the runtime.',
        input_schema: inputSchema,
      },
    ],
    tool_choice: { type: 'tool', name: 'generate_invoml' },
    messages: [{ role: 'user', content: userRequest }],
  })

  // Find the tool_use block
  const toolUse = response.content.find(block => block.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Model did not call the generate_invoml tool')
  }

  // The tool input IS the InvoML document — serialize it for parse()
  const raw = JSON.stringify(toolUse.input)

  // Parse and apply domain validation before calculation
  const parsed = parse(raw)
  if (!parsed.success) {
    throw new Error(`InvoML parse error: ${parsed.errors.join(', ')}`)
  }

  const validation = validate(parsed.document)
  const fatalIssues = validation.issues
    .filter(issue => issue.level === 'error')
    .map(issue => `${issue.code}: ${issue.message}`)
  if (fatalIssues.length > 0) {
    throw new Error(`InvoML validation error(s): ${fatalIssues.join('; ')}`)
  }

  // Compute all totals deterministically
  const totals = calculate(parsed.document)

  // Render to Markdown
  return toMarkdown({ ...parsed.document, totals })
}

// Usage
const markdown = await generateInvoice(
  'Create an invoice from FICTIONAL SAMPLE JACARANDA CRATE SA to FICTIONAL SAMPLE COMET PANTRY SA for retail display products. ' +
  '85,000 MXN for wall panels, 60,000 MXN for five miniature display kits. Apply 16% IVA. Currency MXN.'
)
console.log(markdown)
```

### Notes on Anthropic tool use

- `tool_choice: { type: 'tool', name: 'generate_invoml' }` forces a tool call; it does not guarantee that the tool input conforms to the complete InvoML schema.
- Anthropic's `strict: true` option is what provides provider-side schema conformance. Do not add it to this example without first translating InvoML into Anthropic's supported strict subset.
- The non-strict `input_schema` can use the InvoML schema as generation guidance, but `parse()` plus `validate()` remain the authoritative validation boundary.
- `toolUse.input` is already a parsed JavaScript object (not a string), so you need `JSON.stringify` before passing it to `parse()`, which expects a JSON string.
- Keep the model identifier in configuration and verify it against the current Anthropic model catalog before deployment.
- See Anthropic's current [strict tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use) and [tool definition](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools) guidance.

---

## Google Gemini Structured Output

Gemini supports structured JSON through the Interactions API, but its supported schema is a subset of JSON Schema. Use a permissive JSON-object schema for transport and apply the complete InvoML contract with `parse()` and `validate()`.

### Install

```bash
npm install @google/genai invoml@next
```

The pinned `@google/genai@2.16.0` example requires Node.js 20 or newer. This repository verifies it
on Node.js 22.22.0; the `invoml` package by itself retains Node.js 18 consumer support.

### Complete example

```typescript
import { GoogleGenAI } from '@google/genai'
import { parse, validate, calculate, toMarkdown } from 'invoml'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
const model = requireEnv('GEMINI_MODEL')

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Set ${name} to a currently supported model`)
  return value
}

const SYSTEM_PROMPT = `You are an invoice generation assistant. Given a description of a transaction,
produce a valid InvoML v1.0 document as JSON.

Rules:
- Always include "$invoml": "1.0"
- Never calculate totals, subtotals, or tax amounts — omit items[].amount, items[].taxAmount,
  and the entire "totals" object
- Set currency as a three-letter ISO 4217 code (USD, EUR, GBP, etc.)
- Set issueDate as YYYY-MM-DD
- Set documentType to invoice, quote, credit_note, receipt, or estimate; include
  creditNoteReference when documentType is credit_note
- Declare tax in meta.tax: use { label, rate } for single-rate, or { categories: [...] } for multi-rate
- When using multi-rate tax, set taxCategory on each line item to match the category id
- Use "from" for the seller party, "to" for the buyer party
- Represent discounts in items[].discount (line-level) or discounts[] (invoice-level)
- Never use negative unit prices to represent discounts
- Omit optional fields entirely when they have no value — never use null or empty strings
- Style block names must be exact: "from", "to" (not "parties"), "section:scope" (not "scope")
- The "content" field on from/to is the actual display text with Markdown formatting, not the word "markdown"`

async function generateInvoice(userRequest: string): Promise<string> {
  const interaction = await ai.interactions.create({
    model,
    input: `${SYSTEM_PROMPT}\n\n${userRequest}`,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: {
        type: 'object',
        additionalProperties: true,
      },
    },
  })

  const raw = interaction.output_text
  if (!raw) throw new Error('Empty response from Gemini')

  // Parse and apply domain validation before calculation
  const parsed = parse(raw)
  if (!parsed.success) {
    throw new Error(`InvoML parse error: ${parsed.errors.join(', ')}`)
  }

  const validation = validate(parsed.document)
  const fatalIssues = validation.issues
    .filter(issue => issue.level === 'error')
    .map(issue => `${issue.code}: ${issue.message}`)
  if (fatalIssues.length > 0) {
    throw new Error(`InvoML validation error(s): ${fatalIssues.join('; ')}`)
  }

  // Compute all totals deterministically
  const totals = calculate(parsed.document)

  // Render to Markdown
  return toMarkdown({ ...parsed.document, totals })
}

// Usage
const markdown = await generateInvoice(
  'Invoice from FICTIONAL SAMPLE COPPER OWL LLC to FICTIONAL SAMPLE PINECONE MARKET LLC. ' +
  '80 countertop display kits at $150 each, plus 40 barcode label bundles at $175 each. ' +
  '8.25% sales tax. 5% early payment discount on the invoice total.'
)
console.log(markdown)
```

### Notes on Gemini structured output

- The permissive provider schema constrains the response to a JSON object; it does not validate InvoML fields or domain rules.
- Do not assume the complete InvoML schema can be passed directly to Gemini. Translate it to the currently supported Gemini subset only if you are prepared to maintain that provider-specific schema.
- The Gemini API uses the `@google/genai` package (not the deprecated `@google/generative-ai`).
- Keep the model identifier in configuration and verify it against the current Gemini model catalog before deployment.
- See Google's current [structured output](https://ai.google.dev/gemini-api/docs/structured-output) guidance.

---

## System Prompt Template

Copy and adapt this prompt for any LLM provider. It encodes all the InvoML rules the model needs to produce valid documents.

```
You are an invoice generation assistant. Given a description of a transaction, produce a
valid InvoML v1.0 document. The runtime will compute all arithmetic — your job is to capture
the transaction structure accurately.

## Required fields
- "$invoml": "1.0"  — always include this exact value
- meta.documentType: one of "invoice", "quote", "credit_note", "receipt", "estimate"
- meta.creditNoteReference: required when meta.documentType is "credit_note"
- meta.number: a document number string
- meta.issueDate: date in YYYY-MM-DD format
- meta.currency: three-letter ISO 4217 code (USD, EUR, GBP, JPY, MXN, AUD, CAD, ...)
- items: at least one item with description, quantity (number), unitPrice (number)

## Tax configuration
For a single tax rate (most common):
  meta.tax: { "label": "VAT", "rate": 20 }
  — no taxCategory needed on items

For multiple rates or named tax systems:
  meta.tax: { "categories": [
    { "id": "standard", "label": "Standard VAT 20%", "rate": 20, "default": true },
    { "id": "reduced", "label": "Reduced VAT 5%", "rate": 5 }
  ]}
  — set taxCategory on each item to the matching id
  — the category marked "default": true applies to items with no taxCategory

For inclusive tax (price includes tax, e.g. Australia GST, Singapore GST):
  meta.tax: { "label": "GST", "rate": 10, "inclusive": true }

For compound tax (e.g. Canada GST + PST both on full amount):
  meta.tax: { "compound": true, "categories": [
    { "id": "gst", "label": "GST", "rate": 5 },
    { "id": "pst", "label": "PST", "rate": 7 }
  ]}

For withholding tax (deducted from payment, e.g. Nigeria WHT):
  add "withholding": true to the category

For reverse charge (zero-rate, buyer self-accounts):
  add "reverseCharge": true to the category

## Discounts
Line-level: items[].discount as a string ("10%" or "50") or object
  { "type": "percentage", "value": 10 }  or  { "type": "fixed", "value": 50 }
Invoice-level: discounts[] array, same object shape, with optional "label"

## Critical output rules
- Omit optional fields entirely when they have no value — NEVER use null or empty strings
- Style block names must be exact: "from", "to" (not "parties"), "section:scope" (not "scope")
- Valid block names for style.order: header, from, to, items, totals, payment, notes, section:{key}
- The "content" field on from/to is the actual display text with Markdown, not the word "markdown"

## What to NEVER do
- Never calculate or emit items[].amount or items[].taxAmount
- Never emit a "totals" object — the runtime computes all of these
- Never use negative unitPrice or negative quantity to represent a discount
- Never reference a taxCategory id that is not declared in meta.tax.categories
- Never use strings for quantity or unitPrice — they must be JSON numbers
- Never hardcode a currency symbol in amounts — use the currency code in meta.currency

## Party fields
"from" is the seller/issuer. "to" is the buyer/recipient. Both are optional but
recommended. Use "content" for the complete free-form party, or individual fields
(name, address, taxId, email, phone, countryCode) for structured data, never both.
Structured addresses use `{ "lines": ["line one", "line two"] }`; each entry is one explicit
line and must not contain CR or LF characters.

## Style (presentation hints — optional)
For most invoices, omit "style" entirely. The default order is used automatically.

When the user requests a named theme: "style": { "template": "standard" }
  Templates: "standard" (clean), "minimal" (stripped back), "professional" (monochrome)

When a custom section must appear before items:
  "style": { "order": ["header", "from", "to", "section:scope", "items", "totals", "payment", "notes"] }

Receipt (no to, no payment):
  "style": { "order": ["header", "from", "items", "totals", "notes"] }

Credit note (no payment, with reason section):
  "style": { "order": ["header", "from", "to", "section:reason", "items", "totals", "notes"] }

When the user asks for a two-column party layout:
  "style": { "blocks": { "from": { "span": "half" }, "to": { "span": "half" } } }

Never author raw CSS or style.properties. Colors and fonts are trusted runtime theme/customCss options.
```

---

## Validation Pipeline

The complete flow from LLM response to final output:

```
LLM response (raw JSON string)
       │
       ▼
  parse(rawJson)
       │
       ├─ success: false → handle parse/schema errors[]
       │
       └─ success: true → validate(document)
                              │
                              ├─ domain errors → handle issues[]
                              │
                              └─ no errors → InvoMLDocument
       │
       ▼
  calculate(document)
       │
       └──▶ InvoMLTotals
                │
                ├─ toJSON({ ...document, totals })   → canonical JSON string (for storage / API)
                └─ toMarkdown({ ...document, totals }) → human-readable Markdown (for display)
```

### With error handling

```typescript
import { parse, validate, calculate, toJSON, toMarkdown } from 'invoml'

async function processLLMOutput(rawJson: string): Promise<{
  json: string
  markdown: string
}> {
  // Step 1: Parse the raw JSON text
  const parsed = parse(rawJson)
  if (!parsed.success) {
    throw new Error(`Parse failed: ${parsed.errors.join('; ')}`)
  }

  // Step 2: Apply invoice-specific domain validation
  const validation = validate(parsed.document)
  const fatalIssues = validation.issues.filter(issue => issue.level === 'error')
  if (fatalIssues.length > 0) {
    throw new Error(
      `Validation errors: ${fatalIssues.map(issue => issue.code + ': ' + issue.message).join('; ')}`,
    )
  }

  // Step 3: Calculate — may raise a CalculationError for invalid tax relationships
  const totals = calculate(parsed.document)

  // Step 4: Serialize
  return {
    json: toJSON({ ...parsed.document, totals }),
    markdown: toMarkdown({ ...parsed.document, totals }),
  }
}
```

### Retry loop pattern

Provider-side JSON constraints do not replace InvoML validation. When output fails validation, feed the errors back through the same provider adapter:

```typescript
import { parse, validate } from 'invoml'

type GenerateJson = (prompt: string) => Promise<string>

async function generateWithRetry(
  generateJson: GenerateJson,
  userRequest: string,
  maxAttempts = 3
): Promise<string> {
  let prompt = `${SYSTEM_PROMPT}\n\n${userRequest}`

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const raw = await generateJson(prompt)

    try {
      const parsed = parse(raw)
      if (!parsed.success) {
        throw new Error(`Parse failed: ${parsed.errors.join('; ')}`)
      }
      const validation = validate(parsed.document)
      const fatalIssues = validation.issues.filter(issue => issue.level === 'error')
      if (fatalIssues.length === 0) {
        return raw
      }

      prompt = `${SYSTEM_PROMPT}\n\n${userRequest}\n\nThe previous JSON failed InvoML validation:\n${fatalIssues.map(issue => `${issue.code}: ${issue.message}`).join('\n')}\nReturn a corrected complete JSON object.`
    } catch (error) {
      const message =
        error instanceof Error ? error.message : `Validation failure at attempt ${attempt}`
      prompt = `${SYSTEM_PROMPT}\n\n${userRequest}\n\nThe previous response failed validation:\n${message}\nReturn a corrected complete JSON object.`
    }
  }

  throw new Error(`Failed to generate valid InvoML after ${maxAttempts} attempts`)
}
```

---

## Common Mistakes

### 1. AI pre-calculates totals

**Wrong:** The model emits `"amount": 1200.00` on a line item or fills in the `"totals"` object.

**Why it's wrong:** The runtime overwrites these values anyway, but if your code reads them before calling `calculate()`, you get floating-point totals that may not match the runtime's arbitrary-precision output.

**Fix:** The system prompt must explicitly say *never emit `items[].amount`, `items[].taxAmount`, or the `totals` object*.

---

### 2. Tax category referenced on line but not declared in meta

**Wrong:**
```json
{
  "meta": { "tax": { "categories": [{ "id": "standard", "rate": 20 }] } },
  "items": [{ "taxCategory": "reduced", ... }]
}
```

**Why it's wrong:** `calculate()` cannot resolve `"reduced"` and raises an `UNKNOWN_CATEGORY` calculation error.

**Fix:** Ensure every `taxCategory` value on a line item matches an `id` in `meta.tax.categories`. Tell the model explicitly: *"Only use taxCategory values that appear as ids in meta.tax.categories"*.

---

### 3. Discount as negative line item

**Wrong:**
```json
{ "description": "Discount", "quantity": 1, "unitPrice": -500 }
```

**Why it's wrong:** The schema allows negative `unitPrice` syntactically, but the discount logic is never applied and the line appears in the rendered table as a negative item rather than a clearly labelled discount.

**Fix:** Use `items[].discount` for line-level discounts, or `discounts[]` for invoice-level discounts.

---

### 4. Quantity or unitPrice as strings

**Wrong:** `"quantity": "2"` or `"unitPrice": "150.00"`

**Why it's wrong:** Both fields are `type: number` in the schema. Passing strings will fail `parse()` with a schema validation error.

**Fix:** Always emit bare JSON numbers: `"quantity": 2`, `"unitPrice": 150.00`. The system prompt should say "must be JSON numbers, not strings".

---

### 5. Wrong discount format

**Wrong:** `"discount": "10 percent"` or `"discount": 0.10`

**Why it's wrong:** The schema accepts either a string matching `^\d+(\.\d+)?%|\d+(\.\d+)?$` (e.g. `"10%"` for percentage, `"50"` for fixed) or an object `{ type, value }`. A bare decimal `0.10` does not match either form.

**Fix:** Use `"10%"` for a 10% discount, `"50"` for a fixed $50 discount, or the explicit object form `{ "type": "percentage", "value": 10 }`.

---

### 6. Missing `$invoml` field

**Wrong:** A document with all the right data but no `"$invoml": "1.0"` at the root.

**Why it's wrong:** `$invoml` is in the schema's `required` array. `parse()` will return `{ success: false }`.

**Fix:** The system prompt should say `"$invoml": "1.0"` is always required. The local `parse()` call enforces the schema's `const: "1.0"` rule regardless of provider.

---

### 7. Currency symbol instead of currency code

**Wrong:** `"currency": "$"` or `"currency": "Dollar"`

**Why it's wrong:** The schema requires a three-letter ISO 4217 code matching `^[A-Z]{3}$`. The renderer handles symbol lookup internally.

**Fix:** Always use ISO codes: `"USD"`, `"EUR"`, `"GBP"`, `"MXN"`, `"JPY"`, `"AUD"`, etc.

---

### 8. Skipping `meta.tax` when tax applies

**Wrong:** Line items referencing tax rates in their descriptions, but no `meta.tax` object.

**Why it's wrong:** `calculate()` skips all tax computation when `meta.tax` is absent. The totals will show no tax regardless of descriptions.

**Fix:** Always populate `meta.tax` when the transaction is taxable. The system prompt should include examples for both simple and multi-rate scenarios.

---

### 9. Defining a section but not adding it to `style.order`

**Wrong:**
```json
{
  "sections": { "scope": { "title": "Project Scope", "content": "..." } }
}
```
(No `style` or `style.order` provided.)

**Why it's wrong:** When `style.order` is absent, the default order inserts custom sections *after* `totals`. If the user expects the scope section to appear before the items, the section will appear in the wrong position. If `style.order` is provided but omits the `section:scope` entry, the section is never rendered at all.

**Fix:** When a section must appear in a non-default position, use `style.order` and include the `section:{key}` entry in the desired position:
```json
"style": {
  "order": ["header", "from", "to", "section:scope", "items", "totals", "payment", "notes"]
}
```
Both the `sections` data entry and the `style.order` reference are required for the section to render.

---

### Additional model-output mistakes

These structural mistakes have appeared in model-generated documents when schema descriptions or system-prompt rules were incomplete. The current schema and prompt template address them explicitly.

---

### 10. Setting optional fields to null instead of omitting them

**Wrong:**
```json
{ "description": "Archival storage crates", "quantity": 10, "unitPrice": 200, "discount": null, "taxCategory": null }
```

**Right:**
```json
{ "description": "Archival storage crates", "quantity": 10, "unitPrice": 200 }
```

**Why it's wrong:** JSON `null` is not a valid value for these fields in the schema. `parse()` may reject the document or the runtime may behave unexpectedly.

**Fix:** The system prompt must say *"omit optional fields entirely — never use null or empty strings"*. The schema descriptions now reinforce this.

---

### 11. Using "parties" as a block name in style.order

**Wrong:**
```json
{ "style": { "order": ["header", "parties", "items", "totals", "payment", "notes"] } }
```

**Right:**
```json
{ "style": { "order": ["header", "from", "to", "items", "totals", "payment", "notes"] } }
```

**Why it's wrong:** `"parties"` is not a valid block name. The renderer treats it as an unknown block and skips it, so neither the seller nor buyer information appears.

**Fix:** The system prompt and schema now list all valid block names explicitly: `header`, `from`, `to`, `items`, `totals`, `payment`, `notes`, `section:{key}`.

---

### 12. Forgetting the `section:` prefix for custom sections

**Wrong:**
```json
{ "style": { "order": ["header", "from", "to", "scope", "items", "totals"] } }
```

**Right:**
```json
{ "style": { "order": ["header", "from", "to", "section:scope", "items", "totals"] } }
```

**Why it's wrong:** `"scope"` without the `section:` prefix is treated as an unknown block name and not rendered. The section data exists in `sections.scope` but the renderer cannot find it without the prefix.

**Fix:** Show the `section:{key}` pattern explicitly in examples, not just in prose. The schema description for `style.order` now includes a complete example.

---

### 13. Putting the literal word "markdown" as the content value

**Wrong:**
```json
{ "from": { "content": "markdown", "name": "EXAMPLE LANTERN WORKS", "address": { "lines": ["Sample business location"] } } }
```

**Right:**
```json
{ "from": { "content": "**EXAMPLE LANTERN WORKS**\nSample business location\nExample City" } }
```
Or simply use structured fields without `content`:
```json
{ "from": { "name": "EXAMPLE LANTERN WORKS", "address": { "lines": ["Sample business location", "Example City"] } } }
```

**Why it's wrong:** `content` is the complete free-form representation and is mutually exclusive
with structured fields. The literal word `"markdown"` also loses all party data. The schema rejects
this mixed representation.

**Fix:** The schema description now includes a concrete fictional example of valid `content`: `"**EXAMPLE LANTERN WORKS**\\nSample business location\\nExample City"`.

---

## Quick Reference: Schema import

```typescript
// ES Module — Node.js 22+ / TC39 standard
import schema from 'invoml/invoml-v1.0.schema.json' with { type: 'json' }

// ES Module — Node.js 18-20 (legacy assert syntax)
import schema from 'invoml/invoml-v1.0.schema.json' assert { type: 'json' }

// CommonJS / dynamic import — Node.js 22+ / TC39 standard
const schema = await import('invoml/invoml-v1.0.schema.json', {
  with: { type: 'json' },
})

// CommonJS / dynamic import — Node.js 18-20 (legacy assert syntax)
const schema = await import('invoml/invoml-v1.0.schema.json', {
  assert: { type: 'json' },
})

// Direct file read (when bundler doesn't support JSON imports)
import { readFileSync } from 'fs'
import { resolve } from 'path'
const schema = JSON.parse(
  readFileSync(resolve('./node_modules/invoml/invoml-v1.0.schema.json'), 'utf8')
)
```

---

## Provider Comparison

| | OpenAI | Anthropic | Google Gemini |
|---|---|---|---|
| Mechanism used here | Responses API JSON mode | Forced, non-strict tool call | Interactions structured JSON |
| Provider-side guarantee | Valid JSON | Named tool is called | JSON object matching the permissive provider schema |
| Complete InvoML schema passed directly | No | As non-strict generation guidance only | No |
| Authoritative validation | `parse() → validate()` | `parse() → validate()` | `parse() → validate()` |
| Model configuration | `OPENAI_MODEL` | `ANTHROPIC_MODEL` | `GEMINI_MODEL` |
| SDK package | `openai` | `@anthropic-ai/sdk` | `@google/genai` |
