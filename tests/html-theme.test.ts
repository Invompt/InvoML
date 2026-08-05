import { describe, it, expect } from 'vitest'
import { toHTML } from '../src/html-renderer.js'
import type { InvoMLDocument } from '../src/types.js'

function makeDoc(overrides: Partial<InvoMLDocument> = {}): InvoMLDocument {
  return {
    $invoml: '1.0',
    meta: { documentType: 'invoice', number: 'INV-001', issueDate: '2026-01-01', currency: 'USD' },
    items: [{ description: 'Item', quantity: 1, unitPrice: 100 }],
    ...overrides,
  }
}

describe('toHTML theme option', () => {
  it('applies a preset theme as container CSS properties', () => {
    const html = toHTML(makeDoc(), { theme: 'ember' })
    expect(html).toContain('--invoml-color-accent: #ea580c;')
  })

  it('applies an inline theme object', () => {
    const html = toHTML(makeDoc(), { theme: { accent: 'rebeccapurple' } })
    expect(html).toContain('--invoml-color-accent: rebeccapurple;')
  })

  it('adds the density class to the container', () => {
    const html = toHTML(makeDoc(), { theme: { density: 'compact' } })
    expect(html).toContain('class="invoml-container invoml-density-compact"')
  })

  it('keeps the plain container class without density', () => {
    const html = toHTML(makeDoc(), { theme: 'standard' })
    expect(html).toContain('class="invoml-container"')
  })

  it('throws on unknown preset names', () => {
    expect(() => toHTML(makeDoc(), { theme: 'nope' })).toThrow(/Unknown theme preset/)
  })

  it('does not interpolate invalid runtime density values into HTML', () => {
    const hostileTheme = { density: 'compact"><img src=x onerror=alert(1)>' } as never
    expect(() => toHTML(makeDoc(), { theme: hostileTheme })).toThrow(/Invalid theme density/)
  })

  it('theme wins over the document template despite the template attribute selector', () => {
    // TEMPLATE_CSS uses .invoml-container[data-invoml-template="…"] (specificity 0,2,0);
    // the theme layer must match that specificity or template colors silently win.
    const doc = makeDoc({ style: { template: 'standard' } })
    const html = toHTML(doc, { theme: 'ember' })
    const themeRule = html.indexOf('.invoml-container.invoml-container {\n  --invoml-color-accent: #ea580c;')
    expect(themeRule).toBeGreaterThan(-1)
    expect(themeRule).toBeGreaterThan(html.indexOf('data-invoml-template="standard"'))
  })

})

describe('toHTML customCss option', () => {
  it('appends customCss as the last style layer', () => {
    const doc = makeDoc({ style: { template: 'standard' } })
    const css = '.invoml-header { border-bottom: 4px double currentColor; }'
    const html = toHTML(doc, { theme: 'ember', customCss: css })
    const cssIdx = html.indexOf(css)
    expect(cssIdx).toBeGreaterThan(html.indexOf('Template: standard'))
    expect(cssIdx).toBeLessThan(html.indexOf('</style>'))
  })

  it('works in fragment mode too', () => {
    const css = '.invoml-notes { color: teal; }'
    const html = toHTML(makeDoc({ notes: 'hi' }), { fragment: true, customCss: css })
    expect(html).toContain(css)
  })
})
