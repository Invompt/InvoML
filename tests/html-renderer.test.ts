import { describe, it, expect } from 'vitest'
import { toHTML } from '../src/html-renderer.js'
import { calculate } from '../src/calculator.js'
import type { InvoMLDocument } from '../src/types.js'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDoc(overrides: Partial<InvoMLDocument> = {}): InvoMLDocument {
  return {
    $invoml: '1.0',
    meta: {
      documentType: 'invoice',
      number: 'INV-001',
      issueDate: '2026-01-15',
      dueDate: '2026-02-15',
      currency: 'USD',
    },
    from: { name: 'FICTIONAL SAMPLE LANTERN QUILL CO', address: { lines: ['Sample business location'] }, email: 'billing@renderer.example.invalid' },
    to: { name: 'FICTIONAL SAMPLE HARBOR MARKET CO', address: { lines: ['Sample recipient location'] } },
    items: [
      { description: 'Storage bin cartons', quantity: 40, unitPrice: 150, unit: 'cartons' },
      { description: 'Shelf marker crates', quantity: 10, unitPrice: 120, unit: 'crates' },
    ],
    payment: { beneficiary: 'FICTIONAL SAMPLE LANTERN QUILL CO', bank: 'EXAMPLE BANK', iban: 'EXAMPLE-IBAN-RENDERER' },
    notes: 'Thank you for your business!',
    ...overrides,
  }
}

function withTotals(doc: InvoMLDocument): InvoMLDocument {
  return { ...doc, totals: calculate(doc) }
}

// ─── Basic HTML document structure ────────────────────────────────────────────

describe('toHTML — document structure', () => {
  it('returns a string starting with <!DOCTYPE html>', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i)
  })

  it('contains <html> tag', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('<html')
  })

  it('contains <head> tag', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('<head>')
  })

  it('contains <style> tag with CSS', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('<style>')
    expect(html).toContain('.invoml-container')
  })

  it('contains @media print rules', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('@media print')
  })

  it('contains <body> tag', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('<body>')
  })

  it('contains invoml-container div', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('class="invoml-container"')
  })

  it('has document title in <title> tag', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('<title>INVOICE INV-001</title>')
  })
})

// ─── Block rendering ──────────────────────────────────────────────────────────

describe('toHTML — header block', () => {
  it('renders the document type in header', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('INVOICE')
  })

  it('renders the document number', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('INV-001')
  })

  it('renders the issue date', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('2026-01-15')
  })

  it('renders the due date when present', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('2026-02-15')
  })

  it('renders the currency meta item', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('USD')
  })

  it('renders expiryDate meta item when present', () => {
    const doc = makeDoc({ meta: { ...makeDoc().meta, expiryDate: '2026-04-29' } })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('2026-04-29')
  })

  it('renders creditNoteReference when present', () => {
    const doc = makeDoc({
      meta: {
        documentType: 'credit_note',
        number: 'CN-001',
        issueDate: '2026-01-01',
        currency: 'USD',
        creditNoteReference: 'INV-2026-0142',
      },
    })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('INV-2026-0142')
  })

  it('renders credit note title as CREDIT NOTE', () => {
    const doc = makeDoc({
      meta: {
        documentType: 'credit_note',
        number: 'CN-001',
        issueDate: '2026-01-01',
        currency: 'USD',
      },
    })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('CREDIT NOTE')
  })

  it('has data-invoml-block="header" attribute', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('data-invoml-block="header"')
  })
})

describe('toHTML — party blocks', () => {
  it('renders from party block', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('invoml-party-from')
    expect(html).toContain('FICTIONAL SAMPLE LANTERN QUILL CO')
  })

  it('renders to party block', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('invoml-party-to')
    expect(html).toContain('FICTIONAL SAMPLE HARBOR MARKET CO')
  })

  it('renders from party address', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('Sample business location')
  })

  it('renders structured address lines independently and preserves explicit blanks', () => {
    const doc = makeDoc({
      to: {
        name: 'FICTIONAL SAMPLE POLYGLOT PAPER CO',
        address: { lines: ['サンプル所在地', '', 'موقع تجريبي', 'מיקום לדוגמה'] },
      },
    })
    const html = toHTML(withTotals(doc))

    expect(html).toContain('data-invoml-field="to.address.lines.0"')
    expect(html).toContain('サンプル所在地')
    expect(html).toContain('data-invoml-field="to.address.lines.1" data-invoml-type="text"><br></div>')
    expect(html).toContain('موقع تجريبي')
    expect(html).toContain('מיקום לדוגמה')
  })

  it('renders from party email', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('billing@renderer.example.invalid')
  })

  it('renders attention field prefixed with Attn:', () => {
    const doc = makeDoc({ to: { name: 'FICTIONAL SAMPLE HARBOR MARKET CO', attention: 'Example Finance Team' } })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('Attn: Example Finance Team')
  })

  it('renders taxId prefixed with Tax ID:', () => {
    const doc = makeDoc({ from: { name: 'FICTIONAL SAMPLE COPPER QUILL CO', taxId: 'EXAMPLE-TAX-ID' } })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('Tax ID: EXAMPLE-TAX-ID')
  })

  it('renders businessNumber prefixed with Business No:', () => {
    const doc = makeDoc({ from: { name: 'FICTIONAL SAMPLE CLOCKWORK PAPER CO', businessNumber: 'EXAMPLE-BUSINESS-ID' } })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('Business No: EXAMPLE-BUSINESS-ID')
  })

  it('renders content verbatim (as markdown) when content is set', () => {
    const doc = makeDoc({ from: { content: '**FICTIONAL SAMPLE BOLD QUILL CO**\nSample business location' } })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('<strong>FICTIONAL SAMPLE BOLD QUILL CO</strong>')
    expect(html).not.toContain('Ignored')
  })

  it('skips from block when doc.from is absent', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'invoice', number: 'INV-X', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    }
    const html = toHTML(withTotals(doc))
    expect(html).not.toContain('invoml-party-from')
  })

  it('skips to block when doc.to is absent', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'receipt', number: 'RCP-X', issueDate: '2026-01-01', currency: 'USD' },
      from: { name: 'FICTIONAL SAMPLE MOONBEAM CAFE' },
      items: [{ description: 'Coffee', quantity: 1, unitPrice: 5 }],
    }
    const html = toHTML(withTotals(doc))
    expect(html).not.toContain('invoml-party-to')
  })

  it('has data-invoml-block on party elements', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('data-invoml-block="from"')
    expect(html).toContain('data-invoml-block="to"')
  })
})

describe('toHTML — items table', () => {
  it('renders items table', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('invoml-items')
    expect(html).toContain('Storage bin cartons')
    expect(html).toContain('Shelf marker crates')
  })

  it('renders correct column headers', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('Description')
    expect(html).toContain('Quantity')
    expect(html).toContain('Unit Price')
    expect(html).toContain('Amount')
  })

  it('renders the tax column from a recomputed working copy when totals exist', () => {
    const doc = makeDoc({
      meta: {
        documentType: 'invoice',
        number: 'INV-TAX',
        issueDate: '2026-01-15',
        dueDate: '2026-02-15',
        currency: 'USD',
        tax: { label: 'VAT', rate: 20 },
      },
    })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('<th class="col-right">Tax</th>')
    expect(html).toContain('data-invoml-field="items.0.taxAmount"')
    expect(html).toContain('1,200.00')
  })

  it('renders Unit column when items have unit', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('<th>Unit</th>')
    expect(html).toContain('cartons')
  })

  it('does not render Unit column when no items have unit', () => {
    const doc = makeDoc({
      items: [{ description: 'Storage crate', quantity: 1, unitPrice: 500 }],
    })
    const html = toHTML(withTotals(doc))
    expect(html).not.toContain('<th>Unit</th>')
  })

  it('renders Discount column when items have discount', () => {
    const doc = makeDoc({
      items: [{ description: 'Item', quantity: 1, unitPrice: 100, discount: '10%' }],
    })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('Discount')
  })

  it('has data-invoml-block="items" on table', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('data-invoml-block="items"')
  })

  it('has data-invoml-computed on amount cells', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('data-invoml-computed')
  })

  it('has data-invoml-field on description cells', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('data-invoml-field="items.0.description"')
  })
})

describe('toHTML — totals section', () => {
  it('renders totals block', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('invoml-totals')
  })

  it('renders Subtotal row', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('Subtotal')
  })

  it('renders Total row', () => {
    const html = toHTML(withTotals(makeDoc()))
    // Total (USD)
    expect(html).toContain('Total (USD)')
  })

  it('has data-invoml-block="totals"', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('data-invoml-block="totals"')
  })

  it('skips totals block when doc.totals is absent', () => {
    // Render without calculated totals — the CSS contains ".invoml-totals" so check data attribute
    const doc = makeDoc()
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="totals"')
  })

  it('ignores pre-filled computed item fields when totals are absent', () => {
    const doc = makeDoc({
      meta: {
        documentType: 'invoice',
        number: 'INV-100',
        issueDate: '2026-01-01',
        currency: 'USD',
        tax: { label: 'VAT', rate: 20 },
      },
      items: [{ description: 'Storage crate', quantity: 2, unitPrice: 50, amount: 999, taxAmount: 777 }],
    })

    const html = toHTML(doc)
    expect(html).toContain('data-invoml-field="items.0.taxAmount"')
    expect(html).toContain('20.00')
    expect(html).toContain('100.00')
    expect(html).not.toContain('777.00')
    expect(html).not.toContain('999.00')
    expect(html).not.toContain('data-invoml-block="totals"')
  })
})

describe('toHTML — payment section', () => {
  it('renders payment block', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('invoml-payment')
  })

  it('renders payment beneficiary', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('FICTIONAL SAMPLE LANTERN QUILL CO')
  })

  it('renders payment IBAN', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('EXAMPLE-IBAN-RENDERER')
  })

  it('skips payment block when doc.payment is absent', () => {
    const doc = makeDoc({ payment: undefined })
    const html = toHTML(withTotals(doc))
    expect(html).not.toContain('data-invoml-block="payment"')
  })

  it('has data-invoml-block="payment"', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('data-invoml-block="payment"')
  })

  it('renders payment content as markdown when content is set', () => {
    const doc = makeDoc({
      payment: { content: '**Pay to:** FICTIONAL SAMPLE LANTERN QUILL CO\nBank: EXAMPLE BANK' },
    })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('<strong>Pay to:</strong>')
  })
})

describe('toHTML — notes footer', () => {
  it('renders notes block', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('invoml-notes')
    expect(html).toContain('Thank you for your business!')
  })

  it('skips notes block when doc.notes is absent', () => {
    const doc = makeDoc({ notes: undefined })
    const html = toHTML(withTotals(doc))
    expect(html).not.toContain('data-invoml-block="notes"')
  })

  it('has data-invoml-block="notes"', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('data-invoml-block="notes"')
  })
})

describe('toHTML — custom sections', () => {
  it('renders custom section with title and content', () => {
    const doc = makeDoc({
      sections: { scope: { title: 'Project Scope', content: 'Full redesign.' } },
      style: { order: ['header', 'from', 'to', 'section:scope', 'items', 'totals'] },
    })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('invoml-section')
    expect(html).toContain('Project Scope')
    expect(html).toContain('Full redesign.')
  })

  it('renders persisted section subheadings semantically without literal markers', () => {
    const doc = makeDoc({
      sections: {
        work_summary: {
          title: 'Work Summary',
          content: '### General\n\n- Item one\n\n### Other\n\n- Item two',
        },
      },
      style: {
        order: ['header', 'section:work_summary', 'items', 'totals'],
      },
    })

    const html = toHTML(doc)

    expect(html).toContain('<h3>General</h3>')
    expect(html).toContain('<h3>Other</h3>')
    expect(html).not.toContain('### General')
    expect(html).not.toContain('### Other')
    expect(html.indexOf('<h3>General</h3>')).toBeLessThan(html.indexOf('<h3>Other</h3>'))
  })

  it('renders section titles as editable semantic headings', () => {
    const html = toHTML(makeDoc({
      sections: { work: { title: 'Tasks performed', content: '### General\n\n- One' } },
      style: { order: ['section:work'] },
    }))

    expect(html).toContain('<h2 class="invoml-section-title"')
    expect(html).toContain('data-invoml-field="sections.work.title"')
    expect(html).toContain('<h3>General</h3>')
  })

  it('has data-invoml-block with section:key value', () => {
    const doc = makeDoc({
      sections: { scope: { title: 'Scope', content: 'Details.' } },
      style: { order: ['header', 'section:scope', 'items', 'totals'] },
    })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('data-invoml-block="section:scope"')
  })

  it('skips absent section in order', () => {
    const doc = makeDoc({
      style: { order: ['header', 'section:missing', 'items', 'totals'] },
    })
    const html = toHTML(withTotals(doc))
    expect(html).not.toContain('data-invoml-block="section:missing"')
  })
})

// ─── Style system integration ─────────────────────────────────────────────────

describe('toHTML — style system integration', () => {
  it('applies template attribute on container', () => {
    const doc = makeDoc({ style: { template: 'minimal' } })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('data-invoml-template="minimal"')
  })

  it('supports the professional template and safe page boundaries', () => {
    const html = toHTML(makeDoc({
      sections: { advice: { title: 'Payment advice', content: 'Return with payment.' } },
      style: {
        template: 'professional',
        order: ['items', 'totals', 'section:advice'],
        blocks: { 'section:advice': { breakBefore: 'page', keepTogether: true } },
      },
    }))

    expect(html).toContain('data-invoml-template="professional"')
    expect(html).toContain('data-invoml-break-before="page"')
    expect(html).toContain('data-invoml-keep-together="true"')
    expect(html).toContain('page-break-before: always')
    expect(html).toContain('Template: professional')
  })

  it('includes template CSS in <style> block', () => {
    const doc = makeDoc({ style: { template: 'standard' } })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('Template: standard')
  })

  it('maps typed alignment tokens to semantic attributes', () => {
    const doc = makeDoc({
      style: { blocks: { header: { align: 'center' } } },
    })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('data-invoml-align="center"')
  })

  it('groups half spans into one deterministic row', () => {
    const doc = makeDoc({
      style: {
        blocks: {
          from: { span: 'half' },
          to: { span: 'half' },
        },
      },
    })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('data-invoml-span="half"')
    expect(html.indexOf('data-invoml-block="from"')).toBeLessThan(html.indexOf('data-invoml-block="to"'))
  })

  it('applies asymmetric span tokens', () => {
    const doc = makeDoc({
      style: {
        blocks: {
          from: { span: 'two-thirds' },
          to: { span: 'one-third' },
        },
      },
    })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('data-invoml-span="two-thirds"')
    expect(html).toContain('data-invoml-span="one-third"')
  })

  it('defaults to the standard template when none is authored', () => {
    const doc = makeDoc()
    const html = toHTML(withTotals(doc))
    expect(html).toContain('data-invoml-template="standard"')
  })
})

// ─── Block ordering in HTML ───────────────────────────────────────────────────

describe('toHTML — block ordering', () => {
  it('renders blocks in default order when no style.order', () => {
    const html = toHTML(withTotals(makeDoc()))
    const headerIdx = html.indexOf('data-invoml-block="header"')
    const fromIdx = html.indexOf('data-invoml-block="from"')
    const toIdx = html.indexOf('data-invoml-block="to"')
    const itemsIdx = html.indexOf('data-invoml-block="items"')
    const totalsIdx = html.indexOf('data-invoml-block="totals"')
    const paymentIdx = html.indexOf('data-invoml-block="payment"')
    const notesIdx = html.indexOf('data-invoml-block="notes"')
    expect(headerIdx).toBeLessThan(fromIdx)
    expect(fromIdx).toBeLessThan(toIdx)
    expect(toIdx).toBeLessThan(itemsIdx)
    expect(itemsIdx).toBeLessThan(totalsIdx)
    expect(totalsIdx).toBeLessThan(paymentIdx)
    expect(paymentIdx).toBeLessThan(notesIdx)
  })

  it('renders blocks in explicit style.order', () => {
    const doc = makeDoc({
      style: { order: ['header', 'to', 'from', 'items', 'totals', 'payment', 'notes'] },
    })
    const html = toHTML(withTotals(doc))
    const toIdx = html.indexOf('data-invoml-block="to"')
    const fromIdx = html.indexOf('data-invoml-block="from"')
    expect(toIdx).toBeLessThan(fromIdx)
  })

  it('skips absent blocks', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'receipt', number: 'RCP-X', issueDate: '2026-01-01', currency: 'USD' },
      from: { name: 'FICTIONAL SAMPLE MOONBEAM CAFE' },
      items: [{ description: 'Coffee', quantity: 1, unitPrice: 4 }],
      style: { order: ['header', 'from', 'items', 'totals', 'notes'] },
    }
    const html = toHTML(withTotals(doc))
    expect(html).not.toContain('data-invoml-block="to"')
    expect(html).not.toContain('data-invoml-block="payment"')
    expect(html).not.toContain('data-invoml-block="notes"')
  })

  it('receipt pattern renders correctly — from, items, totals, notes; no to, no payment', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'receipt', number: 'RCP-Y', issueDate: '2026-01-01', currency: 'USD' },
      from: { name: 'FICTIONAL SAMPLE LANTERN KIOSK' },
      items: [{ description: 'Coffee', quantity: 1, unitPrice: 4 }],
      notes: 'Thanks!',
      style: { order: ['header', 'from', 'items', 'totals', 'notes'] },
    }
    const html = toHTML(withTotals(doc))
    expect(html).toContain('data-invoml-block="from"')
    expect(html).toContain('FICTIONAL SAMPLE LANTERN KIOSK')
    expect(html).toContain('Coffee')
    expect(html).toContain('Thanks!')
    expect(html).not.toContain('data-invoml-block="to"')
    expect(html).not.toContain('data-invoml-block="payment"')
  })
})

// ─── Markdown in HTML ─────────────────────────────────────────────────────────

describe('toHTML — markdown processing', () => {
  it('converts **bold** to <strong>', () => {
    const doc = makeDoc({ notes: 'This is **important** text.' })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('<strong>important</strong>')
  })

  it('converts *italic* to <em>', () => {
    const doc = makeDoc({ notes: 'This is *emphasized* text.' })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('<em>emphasized</em>')
  })

  it('converts [link](url) to <a>', () => {
    const doc = makeDoc({ notes: 'See [our website](https://website.example.invalid) for details.' })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('<a href="https://website.example.invalid">our website</a>')
  })

  it('converts __underline__ to <u>', () => {
    const doc = makeDoc({ notes: 'Note the __underlined term__.' })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('<u>underlined term</u>')
  })

  it('converts unordered list items to <ul><li>', () => {
    const doc = makeDoc({ notes: '- item one\n- item two\n- item three' })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>item one</li>')
    expect(html).toContain('<li>item two</li>')
  })

  it('converts ordered list items to <ol><li>', () => {
    const doc = makeDoc({ notes: '1. first\n2. second' })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('<ol>')
    expect(html).toContain('<li>first</li>')
    expect(html).toContain('<li>second</li>')
  })

  it('processes bold in from party content', () => {
    const doc = makeDoc({ from: { content: '**FICTIONAL SAMPLE LANTERN QUILL CO**\nSample business location' } })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('<strong>FICTIONAL SAMPLE LANTERN QUILL CO</strong>')
  })
})

// ─── Number formatting ────────────────────────────────────────────────────────

describe('toHTML — number formatting', () => {
  it('formats 7200 as 7,200.00 in the totals block', () => {
    const doc = makeDoc({
      items: [{ description: 'Display panel box', quantity: 40, unitPrice: 180, unit: 'boxes' }],
    })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('7,200.00')
  })

  it('formats a large amount with thousands separator', () => {
    const doc = makeDoc({
      items: [{ description: 'Project', quantity: 1, unitPrice: 25000 }],
    })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('25,000.00')
  })

  it('formats negative amount with minus sign', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'credit_note', number: 'CN-001', issueDate: '2026-01-01', currency: 'USD' },
      items: [{ description: 'Refund', quantity: -1, unitPrice: 75 }],
    }
    const html = toHTML(withTotals(doc))
    expect(html).toContain('-75.00')
  })

  it('formats JPY with no decimal places', () => {
    const doc: InvoMLDocument = {
      $invoml: '1.0',
      meta: { documentType: 'receipt', number: 'RCP-J', issueDate: '2026-01-01', currency: 'JPY' },
      from: { name: 'FICTIONAL SAMPLE MOONBEAM CAFE' },
      items: [{ description: 'Matcha', quantity: 1, unitPrice: 1500 }],
    }
    const html = toHTML(withTotals(doc))
    expect(html).toContain('1,500')
    expect(html).not.toContain('1,500.00')
  })
})

// ─── Data attributes ──────────────────────────────────────────────────────────

describe('toHTML — data attributes', () => {
  it('every block has data-invoml-block attribute', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('data-invoml-block="header"')
    expect(html).toContain('data-invoml-block="from"')
    expect(html).toContain('data-invoml-block="to"')
    expect(html).toContain('data-invoml-block="items"')
    expect(html).toContain('data-invoml-block="payment"')
    expect(html).toContain('data-invoml-block="notes"')
  })

  it('amount cells have data-invoml-computed attribute', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('data-invoml-computed')
  })

  it('item description cells have data-invoml-field attribute', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('data-invoml-field="items.0.description"')
    expect(html).toContain('data-invoml-field="items.1.description"')
  })

  it('header meta items have data-invoml-field attributes', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('data-invoml-field="meta.issueDate"')
    expect(html).toContain('data-invoml-field="meta.currency"')
  })

  it('from party name has data-invoml-field attribute', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('data-invoml-field="from.name"')
  })
})

// ─── Security: unescaped documentType in header (IMP-10) ────────────────────

describe('toHTML — security: documentType escaping (IMP-10)', () => {
  it('escapes HTML in documentType when schema is bypassed', () => {
    const doc = {
      $invoml: '1.0',
      meta: {
        documentType: '<img src=x onerror=alert(1)>' as 'invoice',
        number: 'X',
        issueDate: '2026-01-01',
        currency: 'USD',
      },
      items: [{ description: 'x', quantity: 1, unitPrice: 1 }],
    } as unknown as Parameters<typeof toHTML>[0]
    const html = toHTML(withTotals(doc))
    // documentType is uppercased before rendering; verify raw tag is not in output
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<IMG SRC=X')
    expect(html).toContain('&lt;')
  })

  it('escapes angle brackets in documentType header div', () => {
    const doc = {
      $invoml: '1.0',
      meta: {
        documentType: 'invoice</div><script>alert(1)</script><div' as 'invoice',
        number: 'X',
        issueDate: '2026-01-01',
        currency: 'USD',
      },
      items: [{ description: 'x', quantity: 1, unitPrice: 1 }],
    } as unknown as Parameters<typeof toHTML>[0]
    const html = toHTML(withTotals(doc))
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<SCRIPT>')
    expect(html).toContain('&lt;/DIV&gt;')
  })
})

// ─── RenderOptions: fragment mode ────────────────────────────────────────────

describe('toHTML — fragment mode', () => {
  it('returns full document by default', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html')
    expect(html).toContain('<head>')
    expect(html).toContain('<body>')
  })

  it('omits document wrapper when fragment: true', () => {
    const html = toHTML(withTotals(makeDoc()), { fragment: true })
    expect(html).not.toContain('<!DOCTYPE html>')
    expect(html).not.toContain('<html')
    expect(html).not.toContain('<head>')
    expect(html).not.toContain('<body>')
  })

  it('fragment contains style block and container', () => {
    const html = toHTML(withTotals(makeDoc()), { fragment: true })
    expect(html).toContain('<style>')
    expect(html).toContain('invoml-container')
  })

  it('fragment is embeddable — no stray closing tags', () => {
    const html = toHTML(withTotals(makeDoc()), { fragment: true })
    expect(html).not.toContain('</html>')
    expect(html).not.toContain('</body>')
    expect(html).not.toContain('</head>')
  })
})

// ─── RenderOptions: editable mode ────────────────────────────────────────────

describe('toHTML — editable mode', () => {
  it('has no contenteditable attributes by default', () => {
    const html = toHTML(withTotals(makeDoc()))
    expect(html).not.toContain('contenteditable=')
  })

  it('adds contenteditable="true" to editable fields', () => {
    const html = toHTML(withTotals(makeDoc()), { editable: true })
    // Invoice number should be editable
    expect(html).toMatch(/data-invoml-field="meta\.number"[^>]*contenteditable="true"/)
  })

  it('adds contenteditable="false" to computed fields (item amount)', () => {
    const html = toHTML(withTotals(makeDoc()), { editable: true })
    // Item amounts are computed
    expect(html).toMatch(/data-invoml-field="items\.0\.amount"[^>]*contenteditable="false"/)
  })

  it('adds contenteditable="false" to totals computed fields', () => {
    const html = toHTML(withTotals(makeDoc()), { editable: true })
    expect(html).toMatch(/data-invoml-computed[^>]*contenteditable="false"/)
  })

  it('adds aria-label to editable fields', () => {
    const html = toHTML(withTotals(makeDoc()), { editable: true })
    expect(html).toContain('aria-label="Invoice number"')
    expect(html).toContain('aria-label="Issue date"')
    expect(html).toContain('aria-label="Sender name"')
    expect(html).toContain('aria-label="Recipient name"')
  })

  it('adds aria-label to item fields with index', () => {
    const html = toHTML(withTotals(makeDoc()), { editable: true })
    expect(html).toContain('aria-label="Item 1 description"')
    expect(html).toContain('aria-label="Item 2 description"')
  })

  it('combines with fragment mode', () => {
    const html = toHTML(withTotals(makeDoc()), { fragment: true, editable: true })
    expect(html).not.toContain('<!DOCTYPE html>')
    expect(html).toContain('contenteditable="true"')
    expect(html).toContain('aria-label=')
  })
})

// ─── Security: XSS in content fields ─────────────────────────────────────────

describe('toHTML — security: XSS in content fields', () => {
  it('escapes <script> tag in meta.number', () => {
    const doc = makeDoc({ meta: { ...makeDoc().meta, number: '<script>alert(1)</script>' } })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('escapes <img onerror> in from.name', () => {
    const doc = makeDoc({ from: { name: '<img onerror=alert(1) src=x>' } })
    const html = toHTML(withTotals(doc))
    expect(html).not.toContain('<img onerror=')
    expect(html).toContain('&lt;img')
  })

  it('escapes <svg onload> in to.name', () => {
    const doc = makeDoc({ to: { name: '<svg onload=alert(1)>' } })
    const html = toHTML(withTotals(doc))
    expect(html).not.toContain('<svg onload=')
    expect(html).toContain('&lt;svg')
  })

  it('escapes <script> tag in item description', () => {
    const doc = makeDoc({
      items: [{ description: '<script>alert(1)</script>', quantity: 1, unitPrice: 100 }],
    })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('escapes <iframe> in notes', () => {
    const doc = makeDoc({ notes: '<iframe src="javascript:alert(1)">' })
    const html = toHTML(withTotals(doc))
    expect(html).not.toContain('<iframe')
    expect(html).toContain('&lt;iframe')
  })

  it('escapes <script> in from.content', () => {
    const doc = makeDoc({ from: { content: '"><script>alert(1)</script>' } })
    const html = toHTML(withTotals(doc))
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('strips javascript: URL from notes markdown link — outputs text only, no href', () => {
    const doc = makeDoc({ notes: '[click me](javascript:alert(1))' })
    const html = toHTML(withTotals(doc))
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('click me')
  })
})

// ─── style.hidden — hidden columns ───────────────────────────────────────────

describe('toHTML — style.hidden columns', () => {
  function makeDocWithTax(): InvoMLDocument {
    return withTotals(makeDoc({
      meta: {
        documentType: 'invoice',
        number: 'INV-H',
        issueDate: '2026-01-15',
        dueDate: '2026-02-15',
        currency: 'USD',
        tax: { label: 'VAT', rate: 20 },
      },
      items: [
        { description: 'Label roll pack', quantity: 10, unitPrice: 100, unit: 'packs', discount: '5%' },
      ],
    }))
  }

  it('hidden column "tax" — no Tax <th> in output', () => {
    const doc = withTotals(makeDoc({
      meta: {
        documentType: 'invoice',
        number: 'INV-H',
        issueDate: '2026-01-15',
        currency: 'USD',
        tax: { label: 'VAT', rate: 20 },
      },
      style: { hidden: ['tax'] },
    }))
    const html = toHTML(doc)
    expect(html).not.toContain('<th class="col-right">Tax</th>')
  })

  it('hidden column "tax" — no taxAmount <td> in output', () => {
    const doc = withTotals(makeDoc({
      meta: {
        documentType: 'invoice',
        number: 'INV-H',
        issueDate: '2026-01-15',
        currency: 'USD',
        tax: { label: 'VAT', rate: 20 },
      },
      style: { hidden: ['tax'] },
    }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-field="items.0.taxAmount"')
  })

  it('hidden column "unit" — no Unit <th> in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['unit'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('<th>Unit</th>')
  })

  it('hidden column "unit" — no unit cell values in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['unit'] } }))
    const html = toHTML(doc)
    // "cartons" is the unit in the fixture; it should not appear in a unit cell
    expect(html).not.toContain('data-invoml-field="items.0.unit"')
  })

  it('hidden column "discount" — no Discount <th> in output', () => {
    const doc = withTotals(makeDoc({
      items: [{ description: 'Storage crate', quantity: 1, unitPrice: 100, discount: '10%' }],
      style: { hidden: ['discount'] },
    }))
    const html = toHTML(doc)
    expect(html).not.toContain('Discount')
  })

  it('hidden column "quantity" — no Quantity <th> in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['quantity'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('<th class="col-right">Quantity</th>')
  })

  it('hidden column "unitPrice" — no Unit Price <th> in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['unitPrice'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('<th class="col-right">Unit Price</th>')
  })

  it('hidden column "description" — no Description <th> in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['description'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-field="items.*.description"')
  })

  it('hidden column "amount" — no Amount <th> in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['amount'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('<th class="col-right">Amount</th>')
  })

  it('multiple hidden columns simultaneously — all absent from output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['unit', 'quantity', 'amount'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('<th>Unit</th>')
    expect(html).not.toContain('<th class="col-right">Quantity</th>')
    expect(html).not.toContain('<th class="col-right">Amount</th>')
    // description and unitPrice remain
    expect(html).toContain('Description')
    expect(html).toContain('Unit Price')
  })

  it('all optional columns hidden — only description and amount remain in table', () => {
    const doc = withTotals(makeDoc({
      meta: {
        documentType: 'invoice',
        number: 'INV-ALLHIDDEN',
        issueDate: '2026-01-15',
        currency: 'USD',
        tax: { label: 'VAT', rate: 20 },
      },
      items: [
        { description: 'Storage crate', quantity: 5, unitPrice: 100, unit: 'boxes', discount: '5%' },
      ],
      style: { hidden: ['tax', 'unit', 'discount', 'quantity', 'unitPrice'] },
    }))
    const html = toHTML(doc)
    // Remaining columns
    expect(html).toContain('Description')
    expect(html).toContain('<th class="col-right">Amount</th>')
    // Hidden columns absent
    expect(html).not.toContain('<th class="col-right">Tax</th>')
    expect(html).not.toContain('<th>Unit</th>')
    expect(html).not.toContain('Discount')
    expect(html).not.toContain('<th class="col-right">Quantity</th>')
    expect(html).not.toContain('<th class="col-right">Unit Price</th>')
  })

  it('hidden column via prefix "column:tax" behaves same as bare "tax"', () => {
    const doc = withTotals(makeDoc({
      meta: {
        documentType: 'invoice',
        number: 'INV-H2',
        issueDate: '2026-01-15',
        currency: 'USD',
        tax: { label: 'VAT', rate: 20 },
      },
      style: { hidden: ['column:tax'] },
    }))
    const html = toHTML(doc)
    expect(html).not.toContain('<th class="col-right">Tax</th>')
  })

  it('data integrity — hidden column does not mutate the original doc', () => {
    const original = makeDoc({
      meta: {
        documentType: 'invoice',
        number: 'INV-ORIG',
        issueDate: '2026-01-15',
        currency: 'USD',
        tax: { label: 'VAT', rate: 20 },
      },
      style: { hidden: ['tax'] },
    })
    const snapshot = JSON.stringify(original)
    toHTML(withTotals(original))
    expect(JSON.stringify(original)).toBe(snapshot)
  })
})

// ─── style.hidden — hidden blocks ─────────────────────────────────────────────

describe('toHTML — style.hidden blocks', () => {
  it('hidden block "payment" — no data-invoml-block="payment" in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['payment'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="payment"')
  })

  it('hidden block "notes" — no data-invoml-block="notes" in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['notes'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="notes"')
  })

  it('hidden block "from" — no data-invoml-block="from" in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['from'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="from"')
  })

  it('hidden block "to" — no data-invoml-block="to" in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['to'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="to"')
  })

  it('hidden block "header" — no data-invoml-block="header" in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['header'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="header"')
  })

  it('hidden block "totals" — no data-invoml-block="totals" in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['totals'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="totals"')
  })

  it('hidden block "items" — no data-invoml-block="items" in output', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['items'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="items"')
  })

  it('hidden block via prefix "block:payment" behaves same as bare "payment"', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['block:payment'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="payment"')
  })

  it('hidden block does not suppress other blocks', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['payment'] } }))
    const html = toHTML(doc)
    expect(html).toContain('data-invoml-block="header"')
    expect(html).toContain('data-invoml-block="items"')
    expect(html).toContain('data-invoml-block="notes"')
  })

  it('section hidden via "section:terms" — section not rendered', () => {
    const doc = withTotals(makeDoc({
      sections: { terms: { title: 'Terms', content: 'Net 30 days.' } },
      style: {
        order: ['header', 'from', 'to', 'items', 'totals', 'section:terms', 'payment', 'notes'],
        hidden: ['section:terms'],
      },
    }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="section:terms"')
    expect(html).not.toContain('Net 30 days.')
  })

  it('style.hidden + style.order: block in order but also hidden → not rendered', () => {
    const doc = withTotals(makeDoc({
      style: {
        order: ['header', 'from', 'to', 'items', 'totals', 'payment', 'notes'],
        hidden: ['payment'],
      },
    }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="payment"')
  })

  it('empty hidden array → same output as no hidden (all blocks present)', () => {
    const docNoHidden = withTotals(makeDoc())
    const docEmptyHidden = withTotals(makeDoc({ style: { hidden: [] } }))
    const htmlNoHidden = toHTML(docNoHidden)
    const htmlEmptyHidden = toHTML(docEmptyHidden)
    // Both should contain all blocks
    expect(htmlEmptyHidden).toContain('data-invoml-block="payment"')
    expect(htmlEmptyHidden).toContain('data-invoml-block="notes"')
    expect(htmlEmptyHidden).toContain('data-invoml-block="header"')
  })

  it('hidden block with presentation tokens is not rendered', () => {
    const doc = withTotals(makeDoc({
      style: {
        hidden: ['payment'],
        blocks: { payment: { span: 'half' } },
      },
    }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-block="payment"')
  })
})

// ─── style.hidden — hidden meta fields ────────────────────────────────────────

describe('toHTML — style.hidden meta', () => {
  it('hidden meta "dueDate" — Due label not in header', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['dueDate'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-field="meta.dueDate"')
  })

  it('hidden meta "currency" — Currency label not in header', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['currency'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-field="meta.currency"')
  })

  it('hidden meta "reference" — Reference label not in header', () => {
    const doc = withTotals(makeDoc({
      meta: { ...makeDoc().meta, reference: 'PO-9999' },
      style: { hidden: ['reference'] },
    }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-field="meta.reference"')
  })

  it('hidden meta via prefix "meta:dueDate" behaves same as bare "dueDate"', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['meta:dueDate'] } }))
    const html = toHTML(doc)
    expect(html).not.toContain('data-invoml-field="meta.dueDate"')
  })

  it('hidden meta does not suppress non-hidden meta fields', () => {
    const doc = withTotals(makeDoc({ style: { hidden: ['dueDate'] } }))
    const html = toHTML(doc)
    // issueDate is always rendered and not suppressible via hidden meta
    expect(html).toContain('data-invoml-field="meta.issueDate"')
    // currency is not hidden here
    expect(html).toContain('data-invoml-field="meta.currency"')
  })
})

// ─── Locale-aware number formatting ──────────────────────────────────────────

describe('toHTML — locale formatting', () => {
  it('formats numbers in US style by default (no locale)', () => {
    const doc = withTotals(makeDoc())
    const html = toHTML(doc)
    // 40 * 150 = 6,000.00
    expect(html).toContain('6,000.00')
  })

  it('formats numbers in German style for de-DE locale', () => {
    const doc = withTotals(makeDoc({
      meta: { documentType: 'invoice', number: 'INV-DE', issueDate: '2026-01-15', currency: 'EUR', locale: 'de-DE' },
    }))
    const html = toHTML(doc)
    // 6000 in German: 6.000,00
    expect(html).toContain('6.000,00')
    expect(html).not.toContain('6,000.00')
  })

  it('formats numbers in Swiss style for de-CH locale', () => {
    const doc = withTotals(makeDoc({
      meta: { documentType: 'invoice', number: 'INV-CH', issueDate: '2026-01-15', currency: 'CHF', locale: 'de-CH' },
    }))
    const html = toHTML(doc)
    // 6000 in Swiss: 6'000.00 — apostrophe is HTML-escaped to &#39;
    expect(html).toContain("6&#39;000.00")
  })

  it('formats numbers with thin space for fr locale', () => {
    const doc = withTotals(makeDoc({
      meta: { documentType: 'invoice', number: 'INV-FR', issueDate: '2026-01-15', currency: 'EUR', locale: 'fr' },
    }))
    const html = toHTML(doc)
    // 6000 in French: 6 000,00 (thin space)
    expect(html).toContain('6\u202F000,00')
  })
})

describe('toHTML — locale-aware date presentation', () => {
  it('formats issue, due, and expiry leap-day dates in en-SG long form', () => {
    const doc = withTotals(makeDoc({
      meta: {
        documentType: 'quote',
        number: 'Q-SG',
        issueDate: '2024-02-29',
        dueDate: '2024-03-01',
        expiryDate: '2024-03-31',
        currency: 'SGD',
        locale: 'en-SG',
      },
      style: { dateFormat: 'long' },
    }))
    const html = toHTML(doc)

    expect(html).toContain('29 February 2024')
    expect(html).toContain('1 March 2024')
    expect(html).toContain('31 March 2024')
    expect(html).not.toContain('2024-02-29')
  })

  it('formats dates deterministically for ja-JP with UTC', () => {
    const doc = withTotals(makeDoc({
      meta: {
        documentType: 'invoice',
        number: 'INV-JP',
        issueDate: '2024-02-29',
        currency: 'JPY',
        locale: 'ja-JP',
      },
      style: { dateFormat: 'long' },
    }))
    const html = toHTML(doc)
    expect(html).toContain('2024年2月29日')
  })

  it('keeps canonical ISO dates in editable output for lossless DOM extraction', () => {
    const doc = withTotals(makeDoc({
      meta: {
        documentType: 'invoice',
        number: 'INV-EDIT-DATE',
        issueDate: '2024-02-29',
        dueDate: '2024-03-31',
        currency: 'SGD',
        locale: 'en-SG',
      },
      style: { dateFormat: 'long' },
    }))

    const displayHtml = toHTML(doc)
    const editableHtml = toHTML(doc, { editable: true })

    expect(displayHtml).toContain('29 February 2024')
    expect(displayHtml).toContain('31 March 2024')
    expect(editableHtml).toContain('>2024-02-29</span>')
    expect(editableHtml).toContain('>2024-03-31</span>')
    expect(editableHtml).not.toContain('29 February 2024')
    expect(editableHtml).not.toContain('31 March 2024')
  })

  it('keeps ISO presentation by default', () => {
    const html = toHTML(withTotals(makeDoc({
      meta: {
        documentType: 'invoice',
        number: 'INV-ISO',
        issueDate: '2024-02-29',
        currency: 'USD',
        locale: 'en-SG',
      },
    })))
    expect(html).toContain('2024-02-29')
  })
})
