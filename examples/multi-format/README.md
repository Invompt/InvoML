# Multi-Format Showcase

This directory demonstrates an InvoML document at different stages of the pipeline:

| File | Format | Purpose |
|------|--------|---------|
| `invoice.json` | JSON | Canonical InvoML document — used for AI generation and storage |
| `invoice.md` | Markdown | Example rendering output (not an InvoML binding — shows display output) |

The JSON file is a valid InvoML v1.0 document. The Markdown file shows what a renderer might produce from the same data using `toMarkdown()`. Both are fictional samples and not tax invoices.

Token comparison against equivalent legacy formats:
- `invoice.json`: ~522 tokens (2,087 chars ÷ 4)
- UBL 2.1 equivalent: ~2,000+ tokens
- Savings: ~75%
