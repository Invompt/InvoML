// src/themes.ts — Named theme presets for InvoML HTML rendering.

/** Structured, serializable visual theme. All fields optional — unset fields keep BASE_CSS defaults. */
export interface InvoMLTheme {
  /** Accent color (header number, links). Any CSS color. */
  accent?: string
  text?: string
  muted?: string
  border?: string
  background?: string
  fontHeading?: string
  fontBody?: string
  density?: 'compact' | 'normal' | 'spacious'
}

export interface ResolvedTheme {
  /** CSS custom properties for the .invoml-container rule. */
  properties: Record<string, string>
  /** Extra class for the container ('' when density is normal/unset). */
  densityClass: string
}

const SERIF = "Georgia, 'Times New Roman', serif"
const MONO = "'SF Mono', 'Fira Code', Menlo, monospace"

export const THEME_PRESETS: Record<string, InvoMLTheme> = {
  standard:  { accent: '#334155', text: '#111827', muted: '#6b7280', border: '#d1d5db' },
  slate:    { accent: '#475569', text: '#0f172a', muted: '#64748b', border: '#cbd5e1' },
  ember:    { accent: '#ea580c', text: '#1c1917', muted: '#78716c', border: '#e7e5e4' },
  forest:   { accent: '#15803d', text: '#14532d', muted: '#4d7c0f', border: '#d9f99d' },
  violet:   { accent: '#7c3aed', text: '#1e1b4b', muted: '#6d28d9', border: '#ddd6fe' },
  mono:     { accent: '#111111', muted: '#555555', border: '#dddddd', fontHeading: MONO, fontBody: MONO, density: 'compact' },
  editorial: { accent: '#9f1239', fontHeading: SERIF, density: 'spacious' },
}

const THEME_VAR_MAP: ReadonlyArray<[keyof InvoMLTheme, string]> = [
  ['accent', '--invoml-color-accent'],
  ['text', '--invoml-color-text'],
  ['muted', '--invoml-color-muted'],
  ['border', '--invoml-color-border'],
  ['background', '--invoml-color-background'],
  ['fontHeading', '--invoml-font-heading'],
  ['fontBody', '--invoml-font-body'],
]

/** Resolve a preset name or inline theme object into container CSS properties + density class.
 *  Throws on unknown preset names, listing available presets. */
export function resolveTheme(theme: string | InvoMLTheme): ResolvedTheme {
  const obj = typeof theme === 'string' ? THEME_PRESETS[theme] : theme
  if (!obj) {
    throw new Error(`Unknown theme preset "${String(theme)}". Available: ${Object.keys(THEME_PRESETS).join(', ')}`)
  }
  const properties: Record<string, string> = {}
  for (const [key, cssVar] of THEME_VAR_MAP) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim() !== '') properties[cssVar] = value
  }
  const density = obj.density
  if (density !== undefined && density !== 'compact' && density !== 'normal' && density !== 'spacious') {
    throw new Error('Invalid theme density. Expected compact, normal, or spacious.')
  }
  const densityClass = density && density !== 'normal' ? `invoml-density-${density}` : ''
  return { properties, densityClass }
}
