# Multi-Format Showcase

This directory demonstrates an InvoML document at different stages of the pipeline:

| File | Format | Purpose |
|------|--------|---------|
| `invoice.json` | JSON | Canonical InvoML document — used for AI generation and storage |
| `invoice.md` | Markdown | Example rendering output (not an InvoML binding — shows display output) |

The JSON file is a valid InvoML v1.0 document. The Markdown file shows what a renderer might produce from the same data using `toMarkdown()`. Both are fictional samples and not tax invoices.

Token counts depend on the model and tokenizer. Measure `invoice.json` with the tokenizer used by
your application rather than relying on a fixed character-to-token estimate.
