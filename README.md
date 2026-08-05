# InvoML

[![npm](https://img.shields.io/npm/v/invoml?style=flat-square)](https://www.npmjs.com/package/invoml)
[![CI](https://img.shields.io/github/actions/workflow/status/Invompt/InvoML/ci.yml?style=flat-square)](https://github.com/Invompt/InvoML/actions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue?style=flat-square)](LICENSE)

**A compact invoice document format with deterministic calculation and rendering.**

InvoML separates invoice data from the arithmetic and presentation applied by a runtime. The
reference implementation parses JSON, validates structure and domain rules, calculates totals with
decimal arithmetic, and renders HTML or Markdown.

> **Prerelease:** `invoml@1.0.0-alpha.21` is published on the `next` channel. Install it with
> `@next` explicitly; `latest` currently points to an older prerelease.

## Install

```sh
npm install invoml@next
```

Node.js 18 or newer is supported.

## Quick start

The source document contains invoice facts only. Totals are derived by `calculate()`.

```ts
import { calculate, parse, toHTML, validate, validateSchema } from 'invoml'

const source = {
  $invoml: '1.0',
  meta: {
    documentType: 'invoice',
    number: 'DEMO-001',
    issueDate: '2026-08-01',
    currency: 'USD',
  },
  items: [
    { description: 'Example line', quantity: 2, unitPrice: 75 },
  ],
}

const schemaResult = validateSchema(source)
if (!schemaResult.valid) throw new Error('Invalid InvoML shape')

const parsed = parse(JSON.stringify(source))
if (!parsed.success) throw new Error(parsed.errors.join('\n'))

const domainResult = validate(parsed.document)
if (!domainResult.valid) throw new Error('Invalid invoice data')

const totals = calculate(parsed.document)
const html = toHTML({ ...parsed.document, totals })

console.log(totals.total)
console.log(html)
```

The usual flow is:

1. Check raw input with `validateSchema()`.
2. Parse it with `parse()`.
3. Apply domain rules with `validate()`.
4. Derive totals with `calculate()`.
5. Render the calculated document with `toHTML()` or `toMarkdown()`.

## What is included

The main entry point exports the core pipeline plus focused helpers:

- Parsing and validation: `parse`, `validateSchema`, `setSchema`, `validate`.
- Calculation and safe edits: `calculate`, `applyDiscount`, `removeDiscounts`, `applyTax`,
  `removeTax`.
- Output: `toJSON`, `toMarkdown`, `renderMarkdown`, `toHTML`, `renderHTML`.
- Presentation and formatting: `resolvePresentation`, `resolveStyle`, `resolveTheme`,
  `formatDate`, and deterministic number-format helpers.
- Types and constants for documents, totals, styles, themes, locales, and calculation errors.

Focused subpath exports are available for the calculator, renderer, validator, validation,
mutators, formatting, themes, presentation, types, and the JSON Schema. The package also installs
the `invoml` CLI.

## CLI, schema, and specification

Use the prerelease channel for the CLI as well:

```sh
npx invoml@next validate invoice.json
npx invoml@next calculate invoice.json
npx invoml@next html invoice.json > invoice.html
```

The `html` command also accepts `--theme <name>` and `--custom-css <file>`.

- [JSON Schema](invoml-v1.0.schema.json) for structured-output integrations.
- [Specification](SPEC.md) for the document and calculation rules.
- [Conformance vectors](test-vectors/) for independent implementations.
- [LLM integration guide](docs/LLM-INTEGRATION.md) for structured-output workflows.

## Security and data integrity

- Validate untrusted input before parsing or calculating it.
- Treat calculated totals as runtime output, never as authored source data.
- Use `setSchema()` before validation in browser or edge runtimes when filesystem access is not
  available.
- Treat `customCss` as trusted runtime input; it is not an InvoML authoring surface.
- Keep customer data and credentials out of documents, examples, fixtures, and source control.

## Development

```sh
npm ci
npm run check:lock
npm run build
npm test
npm run test:functional
```

Contributions should follow [CONTRIBUTING.md](CONTRIBUTING.md). Report security issues according
to [SECURITY.md](SECURITY.md).

## License

[Apache-2.0](LICENSE)
