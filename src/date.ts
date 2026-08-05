import type { InvoMLDateFormat } from './types.js'

export const DATE_FORMAT_PRESETS: ReadonlyArray<InvoMLDateFormat> = Object.freeze([
  'iso',
  'numeric',
  'medium',
  'long',
])

const DATE_OPTIONS: Record<Exclude<InvoMLDateFormat, 'iso'>, Intl.DateTimeFormatOptions> = {
  numeric: { year: 'numeric', month: 'numeric', day: 'numeric' },
  medium: { year: 'numeric', month: 'short', day: 'numeric' },
  long: { year: 'numeric', month: 'long', day: 'numeric' },
}

function parseISODate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null

  return date
}

function resolveDateLocale(locale?: string): string {
  if (!locale) return 'en'

  try {
    const [canonical] = Intl.getCanonicalLocales(locale.trim().replaceAll('_', '-'))
    if (!canonical) return 'en'
    return Intl.DateTimeFormat.supportedLocalesOf([canonical]).length > 0 ? canonical : 'en'
  } catch {
    return 'en'
  }
}

/**
 * Format a canonical ISO date for presentation. Invalid source dates are returned unchanged so
 * direct renderer calls cannot silently reinterpret malformed data.
 */
export function formatDate(
  value: string,
  locale?: string,
  preset: InvoMLDateFormat = 'iso',
): string {
  if (preset === 'iso') return value
  if (!Object.hasOwn(DATE_OPTIONS, preset)) return value

  const date = parseISODate(value)
  if (!date) return value

  return new Intl.DateTimeFormat(resolveDateLocale(locale), {
    ...DATE_OPTIONS[preset],
    timeZone: 'UTC',
  }).format(date)
}
