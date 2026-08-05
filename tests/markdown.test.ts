import { describe, it, expect } from 'vitest'
import { escapeHtml, processInline, processMarkdown } from '../src/markdown.js'

describe('escapeHtml', () => {
  it('escapes ampersand', () => { expect(escapeHtml('A & B')).toBe('A &amp; B') })
  it('escapes angle brackets', () => { expect(escapeHtml('<div>')).toBe('&lt;div&gt;') })
  it('escapes double quotes', () => { expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;') })
  it('passes through safe text', () => { expect(escapeHtml('Hello World')).toBe('Hello World') })
  it('handles empty string', () => { expect(escapeHtml('')).toBe('') })
  it('escapes multiple special chars', () => { expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;') })
  it('escapes single quotes (IMP-2)', () => {
    expect(escapeHtml("it's a test")).toBe('it&#39;s a test')
  })
  it('escapes mixed quotes (IMP-2)', () => {
    expect(escapeHtml(`a'b"c`)).toBe('a&#39;b&quot;c')
  })
})

describe('processInline', () => {
  it('converts bold **text**', () => {
    expect(processInline('**bold**')).toBe('<strong>bold</strong>')
  })

  it('converts italic *text*', () => {
    expect(processInline('*italic*')).toBe('<em>italic</em>')
  })

  it('converts underline __text__', () => {
    expect(processInline('__underline__')).toBe('<u>underline</u>')
  })

  it('converts links with safe URLs', () => {
    expect(processInline('[click](https://link.example.invalid)')).toContain('href="https://link.example.invalid"')
    expect(processInline('[email](mailto:user@markdown.example.invalid)')).toContain('href="mailto:user@markdown.example.invalid"')
  })

  it('handles combined inline formatting', () => {
    const result = processInline('**bold** and *italic*')
    expect(result).toContain('<strong>bold</strong>')
    expect(result).toContain('<em>italic</em>')
  })

  // XSS prevention
  it('escapes script tags', () => {
    const result = processInline('<script>alert(1)</script>')
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;script&gt;')
  })

  it('escapes img tags with event handlers', () => {
    const result = processInline('<img onerror=alert(1) src=x>')
    expect(result).not.toContain('<img')
    expect(result).toContain('&lt;img')
  })

  it('strips javascript: URLs from links', () => {
    const result = processInline('[click](javascript:alert(1))')
    expect(result).not.toContain('javascript:')
    expect(result).toContain('click') // text preserved
  })

  it('strips data: URLs from links', () => {
    const result = processInline('[click](data:text/html,<script>alert(1)</script>)')
    expect(result).not.toContain('data:')
    expect(result).toContain('click')
  })

  it('strips vbscript: URLs from links', () => {
    const result = processInline('[click](vbscript:msgbox)')
    expect(result).not.toContain('vbscript:')
  })

  it('allows http links', () => {
    const result = processInline('[site](http://site.example.invalid)')
    expect(result).toContain('href="http://site.example.invalid"')
  })

  it('escapes HTML in link URLs to prevent attribute breakout', () => {
    const result = processInline('[click](https://link.example.invalid/a"onmouseover="alert(1))')
    expect(result).not.toContain('"onmouseover=')
  })
})

describe('processMarkdown', () => {
  it('processes single line with inline formatting', () => {
    expect(processMarkdown('**bold**')).toContain('<strong>bold</strong>')
  })

  it('inserts <br> between consecutive lines', () => {
    const result = processMarkdown('line 1\nline 2')
    expect(result).toContain('<br>')
  })

  it('renders unordered list', () => {
    const result = processMarkdown('- item 1\n- item 2')
    expect(result).toContain('<ul>')
    expect(result).toContain('<li>')
    expect(result).toContain('</ul>')
  })

  it('renders ordered list', () => {
    const result = processMarkdown('1. first\n2. second')
    expect(result).toContain('<ol>')
    expect(result).toContain('<li>')
    expect(result).toContain('</ol>')
  })

  it('handles mixed content: text + list + text', () => {
    const result = processMarkdown('Intro\n\n- item\n\nOutro')
    expect(result).toContain('Intro')
    expect(result).toContain('<ul>')
    expect(result).toContain('Outro')
  })

  it('renders ATX headings 1–3 without leaking markdown markers', () => {
    const result = processMarkdown('# Primary\n## Secondary\n### General')

    expect(result).toContain('<h1>Primary</h1>')
    expect(result).toContain('<h2>Secondary</h2>')
    expect(result).toContain('<h3>General</h3>')
    expect(result).not.toContain('###')
  })

  it('supports inline formatting in headings and leaves level 4 as text', () => {
    const result = processMarkdown('### **General**\n#### Unsupported')

    expect(result).toContain('<h3><strong>General</strong></h3>')
    expect(result).toContain('#### Unsupported')
    expect(result).not.toContain('<h4>')
  })

  it('closes list when switching types', () => {
    const result = processMarkdown('- bullet\n1. numbered')
    expect(result).toContain('</ul>')
    expect(result).toContain('<ol>')
  })

  it('applies inline formatting inside list items', () => {
    const result = processMarkdown('- **bold item**')
    expect(result).toContain('<li><strong>bold item</strong></li>')
  })
})
