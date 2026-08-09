# InvoML

[![npm next](https://img.shields.io/npm/v/invoml/next?style=flat-square&label=npm%20next)](https://www.npmjs.com/package/invoml)
[![CI](https://img.shields.io/github/actions/workflow/status/Invompt/InvoML/ci.yml?style=flat-square&label=tests)](https://github.com/Invompt/InvoML/actions)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](package.json)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square)](LICENSE)

**Invoices as data. Totals you can trust. Output anywhere.**

InvoML is a compact, open invoice document format and a TypeScript toolkit for parsing,
validating, calculating, and rendering invoices. Keep invoice facts portable while the runtime
owns arithmetic and presentation.

> **Prerelease:** this source declares `invoml@1.0.0-alpha.23` for the `next` channel. Verify the
> live registry before installation; `latest` intentionally remains on the older
> `1.0.0-alpha.5` prerelease.

## Why InvoML

- **One portable document** — JSON that works across applications, renderers, and AI workflows.
- **Deterministic totals** — decimal arithmetic, currency-aware rounding, discounts, and tax.
- **Validation at every boundary** — JSON Schema checks plus invoice-specific domain rules.
- **Multiple outputs** — render the same document as HTML, Markdown, or canonical JSON.
- **Presentation without lock-in** — locales, themes, templates, and renderer-neutral style tokens.

## Installation

```sh
npm install invoml@next
```

InvoML supports Node.js 18 and newer and ships with TypeScript declarations.

## Quick start

Create the invoice from facts, calculate the totals, then render the calculated document:

```ts
import { calculate, toHTML, validate, type InvoMLDocument } from 'invoml'

const invoice: InvoMLDocument = {
  $invoml: '1.0',
  meta: {
    documentType: 'invoice',
    number: 'DEMO-001',
    issueDate: '2026-08-09',
    currency: 'USD',
  },
  items: [
    { description: 'Example item', quantity: 2, unitPrice: 750 },
  ],
}

const validation = validate(invoice)
if (!validation.valid) {
  throw new Error(validation.issues.map(issue => issue.message).join('\n'))
}

const totals = calculate(invoice)
const html = toHTML({ ...invoice, totals })

console.log(totals.total) // 1500
console.log(html)
```

For untrusted serialized input, call `parse()` before applying domain rules with `validate()`.
Use `validateSchema()` when the input is already a JavaScript value.

```text
JSON input  →  schema validation  →  domain validation  →  calculation  →  output
```

## Core API

| Capability | APIs |
|---|---|
| Parse and validate | `parse`, `validateSchema`, `setSchema`, `validate` |
| Calculate | `calculate`, `CalculationError`, currency-aware rounding helpers |
| Edit safely | `applyDiscount`, `removeDiscounts`, `applyTax`, `removeTax` |
| Render | `toHTML`, `renderHTML`, `toMarkdown`, `renderMarkdown`, `toJSON` |
| Present | `resolvePresentation`, `resolveStyle`, `resolveTheme`, locale and date helpers |

Focused subpath exports are available for the calculator, renderer, validator, mutators,
formatting, themes, presentation, types, and the JSON Schema. The package also includes the
`invoml` CLI.

## CLI

Validate, calculate, or render a document without writing an integration:

```sh
npx invoml@next validate invoice.json
npx invoml@next calculate invoice.json
npx invoml@next html invoice.json > invoice.html
```

The `html` command also accepts `--theme <name>` and `--custom-css <file>`.

## Documentation

- [InvoML specification](https://github.com/Invompt/InvoML/blob/main/SPEC.md)
- [JSON Schema](https://github.com/Invompt/InvoML/blob/main/invoml-v1.0.schema.json)
- [LLM integration guide](https://github.com/Invompt/InvoML/blob/main/docs/LLM-INTEGRATION.md)
- [Conformance vectors](https://github.com/Invompt/InvoML/tree/main/test-vectors)
- [Examples](https://github.com/Invompt/InvoML/tree/main/examples)

## Security and data integrity

- Parse untrusted serialized input, apply domain validation, and only then calculate it.
- Treat calculated totals as runtime output, never as authored source data.
- Call `setSchema()` before validation in browser runtimes where filesystem access is unavailable.
- Treat `customCss` as trusted runtime input; it is not an InvoML authoring surface.
- Keep customer data and credentials out of documents, fixtures, and source control.

See the [security policy](https://github.com/Invompt/InvoML/blob/main/SECURITY.md) to report a vulnerability.

## Development

Use Node.js 22.22.0 and npm 11.11.0 for the canonical repository and release checks. Node.js 18
remains the minimum supported consumer runtime.

```sh
npm ci
npm run check:lock
npm run build
npm test
npm run test:functional
```

Contributions are welcome. Read the [contributing guide](https://github.com/Invompt/InvoML/blob/main/CONTRIBUTING.md) before opening a change.

## License

[Apache-2.0](LICENSE)
