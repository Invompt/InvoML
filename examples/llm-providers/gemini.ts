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
