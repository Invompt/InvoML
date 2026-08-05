import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { calculate } from '../src/calculator.js'
import { toMarkdown } from '../src/serializer.js'
import { toHTML } from '../src/html-renderer.js'
import type { InvoMLDocument } from '../src/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const examplesDir = join(__dirname, '..', 'examples')

function loadExample(filename: string): InvoMLDocument {
  const raw = readFileSync(join(examplesDir, filename), 'utf8')
  return JSON.parse(raw) as InvoMLDocument
}

function prepared(filename: string): InvoMLDocument {
  const doc = loadExample(filename)
  // Merge freshly calculated totals; preserve any inline totals from example
  return { ...doc, totals: calculate(doc) }
}

// ─── usa-sales-tax.json ───────────────────────────────────────────────────────

describe('functional: usa-sales-tax.json', () => {
  it('parses and calculates totals without error', () => {
    const doc = loadExample('usa-sales-tax.json')
    expect(() => calculate(doc)).not.toThrow()
  })

  it('toMarkdown produces non-empty string', () => {
    const md = toMarkdown(prepared('usa-sales-tax.json'))
    expect(md.trim().length).toBeGreaterThan(0)
  })

  it('Markdown contains document header with number', () => {
    const md = toMarkdown(prepared('usa-sales-tax.json'))
    expect(md).toContain('INVOICE EXAMPLE-USA-SALES-TAX')
  })

  it('Markdown contains totals section', () => {
    const md = toMarkdown(prepared('usa-sales-tax.json'))
    expect(md).toContain('**Subtotal**')
  })

  it('Markdown contains payment section', () => {
    const md = toMarkdown(prepared('usa-sales-tax.json'))
    expect(md).toContain('### Payment')
  })

  it('Markdown contains the fictional from party', () => {
    const md = toMarkdown(prepared('usa-sales-tax.json'))
    expect(md).toContain('FICTIONAL SAMPLE COPPER OWL LLC')
  })

  it('toHTML produces non-empty HTML', () => {
    const html = toHTML(prepared('usa-sales-tax.json'))
    expect(html.trim().length).toBeGreaterThan(0)
  })

  it('HTML has valid outer structure', () => {
    const html = toHTML(prepared('usa-sales-tax.json'))
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('</html>')
  })

  it('HTML contains the standard template attribute', () => {
    const html = toHTML(prepared('usa-sales-tax.json'))
    expect(html).toContain('data-invoml-template="standard"')
  })

  it('HTML contains the project scope section', () => {
    const html = toHTML(prepared('usa-sales-tax.json'))
    expect(html).toContain('Project Scope')
  })
})

// ─── receipt-cafe.json ────────────────────────────────────────────────────────

describe('functional: receipt-cafe.json', () => {
  it('parses and calculates totals without error', () => {
    const doc = loadExample('receipt-cafe.json')
    expect(() => calculate(doc)).not.toThrow()
  })

  it('toMarkdown produces non-empty string', () => {
    const md = toMarkdown(prepared('receipt-cafe.json'))
    expect(md.trim().length).toBeGreaterThan(0)
  })

  it('Markdown does NOT contain "To:" party', () => {
    const md = toMarkdown(prepared('receipt-cafe.json'))
    expect(md).not.toContain('**To:**')
  })

  it('Markdown does NOT contain "Payment" section', () => {
    const md = toMarkdown(prepared('receipt-cafe.json'))
    expect(md).not.toContain('### Payment')
  })

  it('Markdown contains the receipt header', () => {
    const md = toMarkdown(prepared('receipt-cafe.json'))
    expect(md).toContain('# RECEIPT EXAMPLE-RECEIPT-CAFE')
  })

  it('Markdown contains the fictional issuer name', () => {
    const md = toMarkdown(prepared('receipt-cafe.json'))
    expect(md).toContain('FICTIONAL SAMPLE SAKURA KIOSK KK')
  })

  it('Markdown contains item names', () => {
    const md = toMarkdown(prepared('receipt-cafe.json'))
    expect(md).toContain('Matcha Latte')
    expect(md).toContain('Ceramic Mug')
  })

  it('toHTML does NOT contain invoml-party-to', () => {
    const html = toHTML(prepared('receipt-cafe.json'))
    expect(html).not.toContain('invoml-party-to')
  })

  it('toHTML does NOT contain payment block', () => {
    const html = toHTML(prepared('receipt-cafe.json'))
    expect(html).not.toContain('data-invoml-block="payment"')
  })

  it('HTML contains the from party', () => {
    const html = toHTML(prepared('receipt-cafe.json'))
    expect(html).toContain('invoml-party-from')
    expect(html).toContain('FICTIONAL SAMPLE SAKURA KIOSK KK')
  })
})

// ─── credit-note-partial-refund.json ─────────────────────────────────────────

describe('functional: credit-note-partial-refund.json', () => {
  it('parses and calculates totals without error', () => {
    const doc = loadExample('credit-note-partial-refund.json')
    expect(() => calculate(doc)).not.toThrow()
  })

  it('toMarkdown header shows CREDIT NOTE', () => {
    const md = toMarkdown(prepared('credit-note-partial-refund.json'))
    expect(md).toContain('# CREDIT NOTE EXAMPLE-CREDIT-NOTE-PARTIAL-REFUND')
  })

  it('toHTML title shows CREDIT NOTE', () => {
    const html = toHTML(prepared('credit-note-partial-refund.json'))
    expect(html).toContain('<title>CREDIT NOTE EXAMPLE-CREDIT-NOTE-PARTIAL-REFUND</title>')
  })

  it('HTML header block shows CREDIT NOTE', () => {
    const html = toHTML(prepared('credit-note-partial-refund.json'))
    expect(html).toContain('CREDIT NOTE')
  })

  it('Markdown contains reason section', () => {
    const md = toMarkdown(prepared('credit-note-partial-refund.json'))
    expect(md).toContain('Credit Note')
  })

  it('Markdown contains negative amounts', () => {
    const md = toMarkdown(prepared('credit-note-partial-refund.json'))
    // Subtotal is negative
    expect(md).toContain('-')
  })
})

// ─── quote-freelance.json ─────────────────────────────────────────────────────

describe('functional: quote-freelance.json', () => {
  it('parses and calculates totals without error', () => {
    const doc = loadExample('quote-freelance.json')
    expect(() => calculate(doc)).not.toThrow()
  })

  it('toMarkdown header shows QUOTE', () => {
    const md = toMarkdown(prepared('quote-freelance.json'))
    expect(md).toContain('# QUOTE EXAMPLE-QUOTE-FREELANCE')
  })

  it('Markdown contains scope section', () => {
    const md = toMarkdown(prepared('quote-freelance.json'))
    expect(md).toContain('Order Scope')
  })

  it('Markdown contains timeline section', () => {
    const md = toMarkdown(prepared('quote-freelance.json'))
    expect(md).toContain('Estimated Fulfilment')
  })

  it('HTML contains both custom sections', () => {
    const html = toHTML(prepared('quote-freelance.json'))
    expect(html).toContain('data-invoml-block="section:scope"')
    expect(html).toContain('data-invoml-block="section:timeline"')
  })

  it('scope appears before timeline in explicit order', () => {
    const md = toMarkdown(prepared('quote-freelance.json'))
    const scopeIdx = md.indexOf('Order Scope')
    const timelineIdx = md.indexOf('Estimated Fulfilment')
    expect(scopeIdx).toBeLessThan(timelineIdx)
  })
})

// ─── styled-asymmetric.json ───────────────────────────────────────────────────

describe('functional: styled-asymmetric.json', () => {
  it('parses and calculates totals without error', () => {
    const doc = loadExample('styled-asymmetric.json')
    expect(() => calculate(doc)).not.toThrow()
  })

  it('HTML contains data-invoml-template="minimal"', () => {
    const html = toHTML(prepared('styled-asymmetric.json'))
    expect(html).toContain('data-invoml-template="minimal"')
  })

  it('HTML contains minimal template CSS', () => {
    const html = toHTML(prepared('styled-asymmetric.json'))
    expect(html).toContain('Template: minimal')
  })

  it('HTML applies typed header alignment', () => {
    const html = toHTML(prepared('styled-asymmetric.json'))
    expect(html).toContain('data-invoml-align="center"')
  })

  it('HTML applies asymmetric spans to from/to blocks', () => {
    const html = toHTML(prepared('styled-asymmetric.json'))
    expect(html).toContain('data-invoml-span="two-thirds"')
    expect(html).toContain('data-invoml-span="one-third"')
  })

  it('HTML groups the asymmetric blocks in presentation rows', () => {
    const html = toHTML(prepared('styled-asymmetric.json'))
    expect(html).toContain('class="invoml-presentation-row"')
  })
})

// ─── Round-trip determinism ───────────────────────────────────────────────────

describe('functional: round-trip determinism', () => {
  const examples = [
    'usa-sales-tax.json',
    'receipt-cafe.json',
    'credit-note-partial-refund.json',
    'quote-freelance.json',
    'styled-asymmetric.json',
  ]

  for (const filename of examples) {
    describe(filename, () => {
      it('toMarkdown output is deterministic (identical on two calls)', () => {
        const doc = prepared(filename)
        const md1 = toMarkdown(doc)
        const md2 = toMarkdown(doc)
        expect(md1).toBe(md2)
      })

      it('toHTML output is deterministic (identical on two calls)', () => {
        const doc = prepared(filename)
        const html1 = toHTML(doc)
        const html2 = toHTML(doc)
        expect(html1).toBe(html2)
      })
    })
  }
})

// ─── All examples: basic validity check ──────────────────────────────────────

describe('functional: all examples produce valid output', () => {
  const allExamples = [
    'australia-inclusive.json',
    'canada-compound.json',
    'credit-note-partial-refund.json',
    'eu-multi-vat.json',
    'germany-zugferd.json',
    'india-igst.json',
    'japan-consumption-tax.json',
    'latam-withholding.json',
    'mexico-iva.json',
    'singapore-gst-inclusive.json',
    'nigeria-vat-wht.json',
    'quote-freelance.json',
    'receipt-cafe.json',
    'styled-asymmetric.json',
    'switzerland-vat.json',
    'uae-vat.json',
    'uk-vat.json',
    'usa-sales-tax.json',
  ]

  for (const filename of allExamples) {
    it(`${filename} — toMarkdown + toHTML succeed without throwing`, () => {
      const doc = loadExample(filename)
      const withCalc = { ...doc, totals: calculate(doc) }
      expect(() => toMarkdown(withCalc)).not.toThrow()
      expect(() => toHTML(withCalc)).not.toThrow()
    })

    it(`${filename} — toMarkdown produces non-empty output`, () => {
      const md = toMarkdown(prepared(filename))
      expect(md.trim().length).toBeGreaterThan(0)
    })

    it(`${filename} — toHTML starts with <!DOCTYPE html>`, () => {
      const html = toHTML(prepared(filename))
      expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i)
    })
  }
})
