<div align="center">

# InvoML

**Open invoice format & TypeScript toolkit** (contract / integrator path)

Portable, deterministic invoice documents — used under Invompt; not the primary end-user product path.

[Install](#installation) | [Quick start](#quick-start) | [Documentation](#documentation) | [Contributing](#contributing)

[![npm next](https://img.shields.io/npm/v/invoml/next?style=flat-square&label=npm%20next)](https://www.npmjs.com/package/invoml)
[![CI](https://img.shields.io/github/actions/workflow/status/Invompt/InvoML/ci.yml?style=flat-square&label=tests)](https://github.com/Invompt/InvoML/actions)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?style=flat-square&logo=node.js&logoColor=white)](package.json)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square)](LICENSE)

</div>


> **Looking for the Invompt product?**  
> Continue anonymously · [`https://mcp.invompt.com/mcp`](https://mcp.invompt.com/mcp) · review-before-send  
> *Turn AI-host work into invoices you review before send — Continue anonymously or OAuth via hosted MCP.*  
> Site: [www.invompt.com](https://www.invompt.com) · Registry: [`com.invompt/invompt`](https://glama.ai/mcp/connectors/com.invompt/invompt) · Wellknown: [invompt-mcp](https://wellknown.network/agents/invompt-mcp)  
> **InvoML** (this repo) is the open invoice **format / TypeScript contract toolkit** used under the hood — a secondary path for integrators, not the primary end-user product.

## Why InvoML

Invoices should be easy to move between applications, safe to calculate, and readable by
people as well as software. InvoML keeps authored facts in a compact JSON document and gives
your runtime clear responsibilities for validation, arithmetic, and presentation.

- **Portable documents** - store and exchange one JSON format across applications and services.
- **Deterministic totals** - calculate with decimal arithmetic, currency-aware rounding, discounts,
  and tax categories instead of trusting pre-calculated model output.
- **Validation at the boundary** - combine JSON Schema checks with invoice-specific domain rules.
- **Flexible output** - render the same document as HTML, Markdown, or canonical JSON.
- **Presentation without lock-in** - use locales, themes, templates, and renderer-neutral style
  tokens without putting raw CSS in the document.

InvoML is an alpha release. Install from the `next` npm tag while the format and APIs continue to
evolve, and pin an exact version when reproducibility matters.

## Installation

```sh
npm install invoml@next
```

InvoML supports Node.js 18 and newer and includes TypeScript declarations.

## Quick start

Create an invoice from facts, validate it, calculate its totals, and render the result:

```ts
import { calculate, toHTML, validate, type InvoMLDocument } from 'invoml'

const invoice: InvoMLDocument = {
  $invoml: '1.0',
  meta: {
    documentType: 'invoice',
    number: 'EXAMPLE-001',
    issueDate: '2026-01-15',
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

const calculated = { ...invoice, totals: calculate(invoice) }
console.log(calculated.totals?.total) // 1500
console.log(toHTML(calculated))
```

For untrusted serialized input, call `parse()` first. Use `validateSchema()` when the input is
already a JavaScript value and you need schema validation without domain rules.

```text
JSON input  ->  schema validation  ->  domain validation  ->  calculation  ->  output
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

Validate, calculate, or render a document from the command line:

```sh
npx invoml@next validate invoice.json
npx invoml@next calculate invoice.json
npx invoml@next html invoice.json > invoice.html
```

The `html` command accepts `--theme <name>` and `--custom-css <file>`.

## Documentation

- [InvoML specification](https://github.com/Invompt/InvoML/blob/main/SPEC.md)
- [JSON Schema](https://github.com/Invompt/InvoML/blob/main/invoml-v1.0.schema.json)
- [Rendering guide](https://github.com/Invompt/InvoML/blob/main/docs/RENDERING.md)
- [LLM integration guide](https://github.com/Invompt/InvoML/blob/main/docs/LLM-INTEGRATION.md)
- [Conformance vectors](https://github.com/Invompt/InvoML/tree/main/test-vectors)
- [Examples](https://github.com/Invompt/InvoML/tree/main/examples)

## Security and data integrity

- Parse untrusted serialized input, validate it, and only then calculate it.
- Treat calculated totals as runtime output, never as authored source data.
- Call `setSchema()` before validation in browser runtimes where filesystem access is unavailable.
- Treat `customCss` as trusted runtime input; it is not an InvoML authoring surface.
- Keep customer data, credentials, and private invoice details out of documents and source control.

See the [security policy](https://github.com/Invompt/InvoML/blob/main/SECURITY.md) to report a
vulnerability privately.

## Contributing

Contributions are welcome. Read the [contributing guide](https://github.com/Invompt/InvoML/blob/main/CONTRIBUTING.md)
before opening a change. Include focused tests and update documentation or examples when behavior
changes.

## License

InvoML is available under the [Apache-2.0 license](LICENSE).
