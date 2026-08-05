import { describe, expect, it } from 'vitest'
import { DATE_FORMAT_PRESETS, formatDate } from '../src/date.js'
import type { InvoMLDateFormat } from '../src/types.js'

describe('date presentation', () => {
  it('exposes the finite preset catalog', () => {
    expect(DATE_FORMAT_PRESETS).toEqual(['iso', 'numeric', 'medium', 'long'])
  })

  it('preserves the canonical source representation for the ISO preset', () => {
    expect(formatDate('2024-02-29', 'en-SG', 'iso')).toBe('2024-02-29')
  })

  it('formats leap day in en-SG using UTC and the long preset', () => {
    expect(formatDate('2024-02-29', 'en-SG', 'long')).toBe('29 February 2024')
  })

  it('supports numeric and medium locale-aware presets', () => {
    expect(formatDate('2024-02-29', 'en-SG', 'numeric')).toBe('29/02/2024')
    expect(formatDate('2024-02-29', 'en-SG', 'medium')).toBe('29 Feb 2024')
  })

  it('formats a Japanese long date with Japanese field order', () => {
    expect(formatDate('2024-02-29', 'ja-JP', 'long')).toBe('2024年2月29日')
  })

  it('returns malformed or impossible source dates unchanged', () => {
    expect(formatDate('2023-02-29', 'en-SG', 'long')).toBe('2023-02-29')
    expect(formatDate('29/02/2024', 'en-SG', 'long')).toBe('29/02/2024')
  })

  it('falls back to English for malformed locale tags', () => {
    expect(formatDate('2024-02-29', 'not_a_locale!', 'long')).toBe('February 29, 2024')
  })

  it('exposes an immutable preset catalog and fails closed for unknown runtime values', () => {
    expect(Object.isFrozen(DATE_FORMAT_PRESETS)).toBe(true)
    expect(() => {
      ;(DATE_FORMAT_PRESETS as InvoMLDateFormat[]).push('long')
    }).toThrow(TypeError)
    expect(formatDate('2024-02-29', 'en-SG', 'unsupported' as InvoMLDateFormat)).toBe('2024-02-29')
  })
})
