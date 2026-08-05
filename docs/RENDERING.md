# InvoML Rendering Guide

This guide defines the rendering contract for InvoML v1.0. The normative data
contract remains `SPEC.md`; the JSON Schema is the machine-readable source of
truth.

## 1. Presentation resolver

All HTML and Markdown presentation decisions pass through one resolver:

```ts
import {
  resolvePresentation,
  renderHTML,
  renderMarkdown,
  toHTML,
  toMarkdown,
} from 'invoml'

const htmlResult = renderHTML(doc)
const markdownResult = renderMarkdown(doc)
const sameHtmlResult = resolvePresentation(doc, 'html')

// Compatibility-shaped output-only helpers
const html = toHTML(doc)
const markdown = toMarkdown(doc)
```

`renderHTML` and `renderMarkdown` return:

```ts
interface PresentationResult {
  output: string
  diagnostics: PresentationDiagnostic[]
}

interface PresentationDiagnostic {
  path: string
  code: string
  status: 'applied' | 'fallback' | 'skipped' | 'rejected'
  support: 'full' | 'partial' | 'none'
  message: string
}
```

Diagnostics are deterministic and sorted by path, code, status, then message.
They report template handling, resolved order, hidden blocks, missing data,
omitted data, block tokens, and target fallbacks. A renderer must not silently
discard presentation intent.

## 2. Authored presentation contract

InvoML authors can select one of exactly three templates:

- `standard`
- `minimal`
- `professional`

Raw CSS and `style.properties` are not part of the InvoML document contract.
`style.blocks` accepts only finite renderer-neutral tokens:

```json
{
  "style": {
    "template": "professional",
    "order": [
      "header",
      "from",
      "to",
      "items",
      "totals",
      "payment",
      "paymentAdvice",
      "notes"
    ],
    "hidden": ["meta:reference"],
    "blocks": {
      "header": {
        "align": "center",
        "keepTogether": true
      },
      "from": { "span": "two-thirds" },
      "to": { "span": "one-third" },
      "paymentAdvice": {
        "breakBefore": "page",
        "keepTogether": true
      }
    }
  }
}
```

Token values:

| Token | Values |
|---|---|
| `span` | `full`, `half`, `one-third`, `two-thirds` |
| `align` | `start`, `center`, `end` |
| `breakBefore` | `page` |
| `breakAfter` | `page` |
| `keepTogether` | boolean |

Block keys are the built-ins `header`, `from`, `to`, `items`, `totals`,
`payment`, `paymentAdvice`, and `notes`, plus `section:{key}`. Unknown keys,
tokens, values, and templates are schema-invalid.

## 3. Order, visibility, and missing data

The canonical default order is:

```text
header → from → to → items → totals → custom sections →
payment → notes → paymentAdvice
```

Custom sections are sorted by key and inserted after totals. An explicit
`style.order` is authoritative. Data omitted from an explicit order is retained
in the document and reported in diagnostics.

`style.hidden` suppresses presentation only. Item columns, blocks, header meta
fields, and `section:{key}` references use the naming rules in `SPEC.md`.
Hidden and missing blocks are both diagnosed; neither mutates source data.

## 4. HTML mapping

The reference HTML renderer maps spans onto a 12-column CSS grid:

| Span | Grid columns |
|---|---:|
| `full` | 12 |
| `half` | 6 |
| `one-third` | 4 |
| `two-thirds` | 8 |

Blocks are consumed in resolved DOM order. If the next span would exceed 12
columns, it starts a new row. Exact-fit rows close immediately. Blocks are
never reordered to fill gaps.

The canonical consecutive `from` / `to` pair defaults to `half` / `half` when
both parties are present; an authored span on either block overrides that
block's default. Other blocks default to `full`.

Alignment uses logical `text-align` values so start/end follow document
direction. A page boundary forces a row boundary and is applied to the row
wrapper, while keep-together applies to the block. Both use modern and legacy
paged-media declarations:

```css
break-before: page;
page-break-before: always;

break-after: page;
page-break-after: always;

break-inside: avoid;
page-break-inside: avoid;
```

Line-item tables use constrained grid children and overflow wrapping so narrow
spans cannot force the invoice container wider.

HTML includes semantic `data-invoml-*` attributes for block identity, field
identity, presentation tokens, locale, direction, and computed/read-only
values. `editable: true` makes authored fields editable while computed values
remain `contenteditable="false"`.

## 5. Markdown mapping

Markdown respects resolved order and visibility. It renders all blocks
sequentially because standard Markdown cannot express column spans, alignment,
paged-media boundaries, or keep-together constraints.

Every authored block token produces a `BLOCK_TOKEN_TARGET_FALLBACK`
diagnostic. The selected visual template similarly produces
`TEMPLATE_TARGET_FALLBACK`. Semantic content and order remain intact.

## 6. Payment advice

Payment advice is opt-in:

```json
{
  "paymentAdvice": {
    "title": "Payment Advice",
    "content": "Return this advice with payment."
  }
}
```

It is valid only for `invoice` documents. Authors may supply only a non-empty
`title` and optional `content`; authored financial fields such as `amountDue`
are schema-invalid.

At each render the resolver calls `calculate(doc)` and ignores cached totals,
cached item amounts, and other derived values. A valid advice renders:

- invoice number
- due date, when authored
- customer derived from the recipient
- currency-formatted amount due
- a blank amount-enclosed field

Zero due is valid. Negative due and non-invoice documents produce domain
diagnostics and skip the block. Calculation failure also produces a diagnostic
and skips the advice instead of exposing stale financial values. The remaining
authored-document preview is diagnostic output only; it does not make an
otherwise invalid invoice safe to persist.

HTML advice mirrors use semantic `data-invoml-payment-advice-field` attributes
and computed/read-only markers. Computed advice values never enter canonical
JSON serialization.

## 7. Trusted runtime styling

`RenderOptions.theme` and `RenderOptions.customCss` remain available for trusted
runtime code:

```ts
const html = toHTML(doc, {
  theme: 'ember',
  customCss: '.invoml-header { border-bottom: 2px solid currentColor; }',
})
```

These options are not document-authored InvoML. Never copy untrusted document
content into `customCss`.

## 8. HTML output modes

`toHTML` and `renderHTML` accept:

| Option | Type | Behavior |
|---|---|---|
| `fragment` | boolean | Return style and container markup without the outer HTML document |
| `editable` | boolean | Add editing metadata; computed fields remain read-only |
| `theme` | preset or `InvoMLTheme` | Apply trusted runtime theme values |
| `customCss` | string | Append trusted runtime CSS as the final cascade layer |

All modes preserve source-document immutability.

## 9. Renderer conformance

A conforming renderer:

1. resolves presentation through the shared contract;
2. preserves resolved block order;
3. applies visibility without deleting data;
4. reports every unsupported or skipped presentation decision;
5. never uses presentation fields in calculation;
6. recalculates payment-advice amount due from authored data;
7. does not mutate the input document;
8. formats currency using ISO 4217 decimal precision;
9. keeps computed values read-only in editable output.
