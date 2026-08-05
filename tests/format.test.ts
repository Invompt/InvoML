import { describe, it, expect } from 'vitest'
import { fmtNum, resolveNumberFormat } from '../src/format.js'
import type { NumberFormatOptions } from '../src/format.js'

describe('fmtNum', () => {
  it('formats with 2 decimal places', () => { expect(fmtNum(7200, 2)).toBe('7,200.00') })
  it('formats with 0 decimal places', () => { expect(fmtNum(7200, 0)).toBe('7,200') })
  it('formats with 3 decimal places', () => { expect(fmtNum(7200.5, 3)).toBe('7,200.500') })
  it('formats zero', () => { expect(fmtNum(0, 2)).toBe('0.00') })
  it('no comma for 3 digits', () => { expect(fmtNum(999, 2)).toBe('999.00') })
  it('comma at 4 digits', () => { expect(fmtNum(1000, 2)).toBe('1,000.00') })
  it('multiple commas for millions', () => { expect(fmtNum(1234567.89, 2)).toBe('1,234,567.89') })
  it('handles negative numbers', () => { expect(fmtNum(-500, 2)).toBe('-500.00') })
  it('handles negative with commas', () => { expect(fmtNum(-1234.56, 2)).toBe('-1,234.56') })
  it('handles very small amounts', () => { expect(fmtNum(0.01, 2)).toBe('0.01') })
})

describe('resolveNumberFormat', () => {
  it('returns en format for en', () => {
    const f = resolveNumberFormat('en')
    expect(f.thousandsSep).toBe(',')
    expect(f.decimalSep).toBe('.')
    expect(f.grouping).toBe('standard')
  })

  it('returns en format for en-US', () => {
    const f = resolveNumberFormat('en-US')
    expect(f.thousandsSep).toBe(',')
    expect(f.decimalSep).toBe('.')
  })

  it('returns en format for ja, ko, zh, ms, th', () => {
    for (const loc of ['ja', 'ko', 'zh', 'zh-CN', 'ms', 'th']) {
      const f = resolveNumberFormat(loc)
      expect(f.decimalSep).toBe('.')
      expect(f.grouping).toBe('standard')
    }
  })

  it('returns de format for de', () => {
    const f = resolveNumberFormat('de')
    expect(f.thousandsSep).toBe('.')
    expect(f.decimalSep).toBe(',')
    expect(f.grouping).toBe('standard')
  })

  it('returns de format for de-DE, es, pt-BR, it, nl', () => {
    for (const loc of ['de-DE', 'es', 'es-AR', 'pt-BR', 'it', 'nl', 'tr', 'ru', 'el', 'ro', 'uk', 'vi', 'id', 'hr', 'sk', 'sl', 'bg']) {
      const f = resolveNumberFormat(loc)
      expect(f.thousandsSep).toBe('.')
      expect(f.decimalSep).toBe(',')
    }
  })

  it('returns ch format for de-CH', () => {
    const f = resolveNumberFormat('de-CH')
    expect(f.thousandsSep).toBe("'")
    expect(f.decimalSep).toBe('.')
    expect(f.grouping).toBe('standard')
  })

  it('returns ch format for fr-CH and it-CH', () => {
    for (const loc of ['fr-CH', 'it-CH']) {
      const f = resolveNumberFormat(loc)
      expect(f.thousandsSep).toBe("'")
      expect(f.decimalSep).toBe('.')
    }
  })

  it('Swiss locales override the de/fr prefix — de-CH is ch, not de', () => {
    const de = resolveNumberFormat('de')
    const deCH = resolveNumberFormat('de-CH')
    expect(de.thousandsSep).toBe('.')
    expect(deCH.thousandsSep).toBe("'")
  })

  it('returns in format for hi, en-IN, hi-IN and Indian language codes', () => {
    for (const loc of ['hi', 'hi-IN', 'en-IN', 'mr', 'bn', 'ta', 'te', 'kn', 'gu', 'ml', 'pa']) {
      const f = resolveNumberFormat(loc)
      expect(f.grouping).toBe('indian')
      expect(f.decimalSep).toBe('.')
    }
  })

  it('returns space format for fr and fr-FR', () => {
    for (const loc of ['fr', 'fr-FR']) {
      const f = resolveNumberFormat(loc)
      expect(f.thousandsSep).toBe('\u202F')
      expect(f.decimalSep).toBe(',')
    }
  })

  it('returns space format for sv, nb, nn, fi, pl, cs, da, et, lv, lt', () => {
    for (const loc of ['sv', 'nb', 'nn', 'fi', 'pl', 'cs', 'da', 'et', 'lv', 'lt']) {
      const f = resolveNumberFormat(loc)
      expect(f.thousandsSep).toBe('\u202F')
      expect(f.decimalSep).toBe(',')
    }
  })

  it('returns en format for unknown locale', () => {
    const f = resolveNumberFormat('xx-XX')
    expect(f.thousandsSep).toBe(',')
    expect(f.decimalSep).toBe('.')
  })

  it('returns en format for undefined', () => {
    const f = resolveNumberFormat(undefined)
    expect(f.thousandsSep).toBe(',')
    expect(f.decimalSep).toBe('.')
  })

  it('is case-insensitive', () => {
    expect(resolveNumberFormat('DE')).toEqual(resolveNumberFormat('de'))
    expect(resolveNumberFormat('DE-CH')).toEqual(resolveNumberFormat('de-CH'))
    expect(resolveNumberFormat('FR-CH')).toEqual(resolveNumberFormat('fr-CH'))
    expect(resolveNumberFormat('HI')).toEqual(resolveNumberFormat('hi'))
  })
})

describe('fmtNum with NumberFormatOptions', () => {
  describe('de format', () => {
    const opts: NumberFormatOptions = { thousandsSep: '.', decimalSep: ',', grouping: 'standard' }

    it('formats with period thousands and comma decimal', () => {
      expect(fmtNum(1234567.89, 2, opts)).toBe('1.234.567,89')
    })

    it('formats zero', () => {
      expect(fmtNum(0, 2, opts)).toBe('0,00')
    })

    it('formats negative', () => {
      expect(fmtNum(-1234.56, 2, opts)).toBe('-1.234,56')
    })

    it('formats with 0 decimal places', () => {
      expect(fmtNum(7200, 0, opts)).toBe('7.200')
    })

    it('formats with 3 decimal places', () => {
      expect(fmtNum(7200.5, 3, opts)).toBe('7.200,500')
    })

    it('formats small number without separator', () => {
      expect(fmtNum(999, 2, opts)).toBe('999,00')
    })
  })

  describe('ch format', () => {
    const opts: NumberFormatOptions = { thousandsSep: "'", decimalSep: '.', grouping: 'standard' }

    it('formats with apostrophe thousands', () => {
      expect(fmtNum(1234567.89, 2, opts)).toBe("1'234'567.89")
    })

    it('formats negative with apostrophe', () => {
      expect(fmtNum(-9876543.21, 2, opts)).toBe("-9'876'543.21")
    })

    it('formats with 0 dp', () => {
      expect(fmtNum(1234, 0, opts)).toBe("1'234")
    })
  })

  describe('in format (Indian grouping)', () => {
    const opts: NumberFormatOptions = { thousandsSep: ',', decimalSep: '.', grouping: 'indian' }

    it('groups lakhs and crores correctly', () => {
      expect(fmtNum(1234567.89, 2, opts)).toBe('12,34,567.89')
      expect(fmtNum(100000000, 2, opts)).toBe('10,00,00,000.00')
    })

    it('under 10000: same as standard', () => {
      expect(fmtNum(1234, 2, opts)).toBe('1,234.00')
    })

    it('exactly 5 digits', () => {
      expect(fmtNum(12345, 2, opts)).toBe('12,345.00')
    })

    it('6 digits', () => {
      expect(fmtNum(123456, 2, opts)).toBe('1,23,456.00')
    })

    it('7 digits', () => {
      expect(fmtNum(1234567, 0, opts)).toBe('12,34,567')
    })

    it('8 digits', () => {
      expect(fmtNum(12345678, 0, opts)).toBe('1,23,45,678')
    })

    it('negative with indian grouping', () => {
      expect(fmtNum(-1234567.89, 2, opts)).toBe('-12,34,567.89')
    })

    it('zero', () => {
      expect(fmtNum(0, 2, opts)).toBe('0.00')
    })
  })

  describe('space format', () => {
    const opts: NumberFormatOptions = { thousandsSep: '\u202F', decimalSep: ',', grouping: 'standard' }

    it('formats with thin space thousands and comma decimal', () => {
      expect(fmtNum(1234567.89, 2, opts)).toBe('1\u202F234\u202F567,89')
    })

    it('formats small number without separator', () => {
      expect(fmtNum(999, 2, opts)).toBe('999,00')
    })

    it('formats negative', () => {
      expect(fmtNum(-1234.56, 2, opts)).toBe('-1\u202F234,56')
    })
  })

  it('negative zero normalizes across formats', () => {
    const opts: NumberFormatOptions = { thousandsSep: '.', decimalSep: ',', grouping: 'standard' }
    expect(fmtNum(-0, 2, opts)).toBe('0,00')
    expect(fmtNum(-0, 2)).toBe('0.00')
  })

  it('non-finite throws', () => {
    expect(() => fmtNum(Infinity, 2)).toThrow()
    expect(() => fmtNum(NaN, 2)).toThrow()
    const opts: NumberFormatOptions = { thousandsSep: '.', decimalSep: ',', grouping: 'standard' }
    expect(() => fmtNum(Infinity, 2, opts)).toThrow()
  })
})
