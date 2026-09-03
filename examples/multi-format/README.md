# Multi-format example

This directory shows one InvoML document at two stages of the pipeline:

| File | Format | Purpose |
|------|--------|---------|
| `invoice.json` | JSON | Canonical InvoML document for generation and storage |
| `invoice.md` | Markdown | Renderer output produced from the same data |

The Markdown file is display output, not a second InvoML binding. Both files contain fictional
sample data and are not tax invoices.

Use the [main README](../../README.md) for installation and the [rendering guide](../../docs/RENDERING.md)
for renderer behavior. Token counts depend on the model and tokenizer; measure the JSON with the
tokenizer used by your application instead of relying on a fixed estimate.
