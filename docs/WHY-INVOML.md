# Why InvoML

This document explains the landscape of invoice formats, what each was designed for, and where InvoML fits in.

---

## The current landscape

If you're building an AI feature that generates invoices, you'll encounter several categories of existing formats:

1. **Enterprise document standards** — XML-based formats designed for government procurement and B2B compliance
2. **Ad-hoc JSON** — whatever schema the developer defines on the spot
3. **Platform-specific formats** — invoice objects inside SaaS billing platforms
4. **PDF** — the most common output format, often mistaken for a data format

Each was designed for a different era and a different set of constraints. Understanding what they do well is the best way to understand where InvoML fits.

---

## Enterprise document standards

The most widely adopted standard for structured invoice data is **UBL (Universal Business Language)**, an XML-based format maintained by OASIS and formalized as ISO/IEC 19845. If you've worked with European e-invoicing, government procurement, or cross-border B2B trade, you've likely encountered UBL — or one of the formats built on top of it.

UBL is the foundation of several regional systems:

- **Peppol** — the pan-European e-invoicing network used by 40+ countries, which mandates UBL-based documents for public procurement
- **ZUGFeRD / Factur-X** — a German/French hybrid that embeds a UBL or UN/CEFACT XML invoice inside a PDF/A-3 file, so the same document is both human-readable and machine-readable
- **FatturaPA** (Italy), **SII** (Spain), **KSeF** (Poland) — national e-invoicing systems that either use UBL directly or define their own XML schemas heavily influenced by UBL's data model

These formats are battle-tested in compliance-heavy environments. They handle complex tax scenarios, multi-party supply chains, and legal requirements across dozens of jurisdictions. They've been refined over two decades and are backed by standards bodies, governments, and large enterprise software vendors.

### Where they fall short for AI

UBL and its derivatives were designed for enterprise integration systems — EDI pipelines, ERP imports, government portals. They work well in those contexts. But they present specific challenges when an LLM is the document author:

**Token cost.** A minimal UBL invoice — one line item, two parties, one tax rate — begins with namespace declarations, profile identifiers, and schema locations that consume roughly 200 tokens before the first business field (`<cbc:ID>`) appears. For LLM calls where every token has a cost, this overhead matters.

**Structural complexity.** UBL defines over 65 document types with shared aggregate components. A party name lives four nesting levels deep inside `cac:AccountingSupplierParty > cac:Party > cac:PartyName > cbc:Name`. Generating valid UBL from an LLM typically requires either fine-tuning or multi-shot prompting that consumes a significant portion of the context window.

**Pre-calculated totals.** UBL documents carry pre-calculated sums in `cac:LegalMonetaryTotal`. The document author — whether human or AI — must compute these correctly. If an LLM hallucinates a rounding error or gets a compound tax calculation wrong, the totals are silently wrong. There's no independent runtime that recomputes from first principles.

**No JSON Schema.** Modern LLM APIs (OpenAI Structured Outputs, Anthropic tool use, Gemini structured output) accept JSON Schema to constrain model output. XML standards don't plug into these APIs without a translation layer.

None of this makes UBL a bad standard — it's excellent at what it was designed for. It just wasn't designed for a world where language models are generating documents token by token.

---

## Ad-hoc JSON

A developer's first instinct when adding invoice generation to an AI feature is often: "just tell the model to return JSON." This works for demos and breaks in production.

### The consistency problem

Without a schema, the model chooses what fields to include. Across requests you get:

- `total` vs `totalAmount` vs `grandTotal` — same concept, different keys each call
- Pre-calculated `subtotal` that doesn't match the sum of line items
- Tax amounts that don't correspond to the stated rate
- Fields that appear or disappear depending on prompt phrasing

### The arithmetic problem

Most developers don't realize that floating-point arithmetic produces different results across environments. `0.1 + 0.2` in JavaScript is `0.30000000000000004`. A 5% discount on a $2,357.33 subtotal rounds differently in Python, JavaScript, Ruby, and Go when using native floats.

For invoices — where totals must be legally correct — this is a real problem. A document that shows one total in the generation environment and a different total when re-calculated by the recipient is wrong, even if the difference is one cent.

### The tax model problem

Most ad-hoc schemas assume a single flat tax rate. Real invoices have:

- **Multi-rate taxes** — multiple tax categories on the same document (e.g., standard rate + reduced rate + exempt)
- **Compound taxes** — one tax calculated on the base, another on the base plus the first tax (e.g., Canadian GST + PST)
- **Inclusive taxes** — tax baked into the listed price rather than added on top (e.g., Australian GST)
- **Reverse charge** — zero tax on the document, buyer self-assesses (common in EU cross-border trade)
- **Withholding taxes** — issuer reports the amount, buyer remits to tax authority (common in Latin America and Africa)

Each requires a different calculation tree. No ad-hoc schema handles all of them correctly without significant engineering effort.

---

## Platform-specific formats

Services like Xero, QuickBooks, FreshBooks, Stripe Invoicing, and Wave each expose their own invoice objects via API. These work well within their ecosystems but present challenges as a general format:

- **Not portable** — an invoice object from one platform doesn't transfer to another without custom transformation
- **Require a platform relationship** — you must be a customer to create invoices in their format
- **Not designed for direct AI generation** — the APIs were built for human developers building integrations, not for LLMs as first-class document authors
- **Not version-controllable** — you can't diff two invoice versions in git or build deterministic tests against the format

---

## PDF

PDF is the most common invoice format in the real world — easy to send, easy to read, hard to dispute visually. But it's an output format, not a data format:

- **Extraction is lossy** — parsing structured data from PDF requires OCR or heuristic text extraction, both error-prone
- **No schema** — there's no structural guarantee about where any field appears
- **Not diffable** — two visually identical PDFs may have completely different internal representations
- **Not machine-readable by design** — PDF was designed for printing

Hybrid formats like ZUGFeRD address this by embedding structured XML inside a PDF. This is pragmatic but inherits the XML complexity described above.

---

## The presentation problem

Every format above shares one assumption: visual presentation is someone else's problem.

UBL carries financial data with extreme precision — tax identifiers, regulatory references, line-item detail — but says nothing about how the document looks. The PDF that arrives in a buyer's inbox is produced by whatever ERP system generated it, with no visual intent from the document itself.

Ad-hoc JSON carries whatever the developer decided to include. Rendering is left to the frontend, which has to guess at structure, invent a layout, and pick colors.

Platform-specific formats delegate presentation to the platform. The invoice looks however Stripe or QuickBooks decided it should look. No customization travels with the data.

This gap matters for AI-generated invoices because the generation and rendering happen in different systems. The AI model produces the document. A separate runtime calculates the math. A separate renderer turns it into HTML or PDF. If the document carries no visual intent, the renderer must make all presentation decisions — and the AI's understanding of what the user wanted is lost.

InvoML closes this gap with an optional `style` field:

```json
"style": {
  "template": "minimal",
  "order": ["header", "from", "to", "section:scope", "items", "totals", "payment"],
  "blocks": {
    "header": { "align": "center" },
    "from": { "span": "half" },
    "to": { "span": "half" }
  }
}
```

The style system is deliberately compact and uses a finite renderer-neutral token vocabulary. Raw CSS is invalid document-authored InvoML. A document without `style` renders with sensible defaults.

This is not a rendering engine. It carries block order, built-in templates, visibility, layout spans, alignment, and paged-media intent while keeping data machine-readable and math deterministic.

---

## Where InvoML fits

InvoML doesn't replace enterprise standards for their intended use cases. If you need Peppol compliance for EU government procurement, use UBL — it's the right tool for that job.

InvoML is designed for a different problem: **AI systems that need to generate invoice documents as structured output.** It optimizes for:

| | InvoML's approach |
|---|---|
| **Token efficiency** | Minimal JSON syntax, no namespace overhead, compact field names |
| **Deterministic math** | AI generates data only; a runtime computes all totals with arbitrary-precision arithmetic |
| **LLM-native** | JSON Schema plus domain validation provide the authoritative runtime boundary after provider output |
| **Human readability** | Plain JSON with inline Markdown content — readable without specialized tools |
| **International tax** | Covers single-rate, multi-rate, compound, inclusive, reverse-charge, and withholding models |
| **Conformance testing** | 21 canonical test vectors define successful calculations and required error behavior |
| **Vendor neutral** | Apache 2.0, no platform dependency, any language can implement it |
| **Presentation intent** | Optional `style` field carries finite templates, order, visibility, layout, and pagination tokens |

### The core design decision

The most important difference between InvoML and every other format: **the AI never calculates totals.**

In every other approach — UBL, ad-hoc JSON, platform APIs — the document author computes and includes the totals. When the author is an LLM, this means trusting a probabilistic model with arithmetic. InvoML removes this entirely. The AI fills in rates, quantities, and prices. The runtime does all the math with arbitrary-precision decimal arithmetic. A conforming implementation must produce the numeric results defined by the normative vectors under the specification's currency and half-up rounding rules.

The second important decision: **the document carries visual intent, not just data.** InvoML's `style` field lets the AI express block order, built-in templates, visibility, layout spans, alignment, and pagination through finite renderer-neutral tokens. Raw CSS remains a trusted runtime concern.

---

## The single sentence

Existing business document formats carry data for machines. InvoML carries data, math rules, and visual intent — everything an AI needs to generate a complete invoice that renders correctly for humans.
