import { describe, it, expect } from 'vitest'
import { THEME_PRESETS, resolveTheme } from '../src/themes.js'
import type { InvoMLTheme } from '../src/themes.js'

describe('THEME_PRESETS', () => {
  it('contains the documented presets', () => {
    for (const name of ['standard', 'slate', 'ember', 'forest', 'violet', 'mono', 'editorial']) {
      expect(THEME_PRESETS[name], `preset "${name}"`).toBeDefined()
    }
  })

  it('every preset resolves without error', () => {
    for (const name of Object.keys(THEME_PRESETS)) {
      expect(() => resolveTheme(name)).not.toThrow()
    }
  })
})

describe('resolveTheme', () => {
  it('resolves a preset by name to container CSS properties', () => {
    const resolved = resolveTheme('ember')
    expect(resolved.properties['--invoml-color-accent']).toBe('#ea580c')
    expect(resolved.properties['--invoml-color-text']).toBe('#1c1917')
  })

  it('throws on unknown preset names, listing available presets', () => {
    expect(() => resolveTheme('nope')).toThrow(/Unknown theme preset "nope"/)
    expect(() => resolveTheme('nope')).toThrow(/standard/)
  })

  it('accepts an inline theme object', () => {
    const theme: InvoMLTheme = { accent: 'rebeccapurple', fontBody: 'Georgia, serif' }
    const resolved = resolveTheme(theme)
    expect(resolved.properties['--invoml-color-accent']).toBe('rebeccapurple')
    expect(resolved.properties['--invoml-font-body']).toBe('Georgia, serif')
  })

  it('omits unset fields so BASE_CSS defaults apply', () => {
    const resolved = resolveTheme({ accent: '#123456' })
    expect(Object.keys(resolved.properties)).toEqual(['--invoml-color-accent'])
  })

  it('skips empty-string values', () => {
    const resolved = resolveTheme({ accent: '  ', text: '#000' })
    expect(resolved.properties['--invoml-color-accent']).toBeUndefined()
    expect(resolved.properties['--invoml-color-text']).toBe('#000')
  })

  it('maps density to a container class', () => {
    expect(resolveTheme({ density: 'compact' }).densityClass).toBe('invoml-density-compact')
    expect(resolveTheme({ density: 'spacious' }).densityClass).toBe('invoml-density-spacious')
  })

  it('returns empty densityClass for normal or unset density', () => {
    expect(resolveTheme({ density: 'normal' }).densityClass).toBe('')
    expect(resolveTheme({}).densityClass).toBe('')
  })

  it('rejects invalid runtime density values', () => {
    const hostileTheme = { density: 'compact"><img src=x onerror=alert(1)>' } as unknown as InvoMLTheme
    expect(() => resolveTheme(hostileTheme)).toThrow(/Invalid theme density/)
  })
})
