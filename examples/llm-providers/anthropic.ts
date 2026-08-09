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
