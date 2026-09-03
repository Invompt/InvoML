import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { profiles, validateDocument } from '../scripts/validate-public-readmes.mjs'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string }

describe('README installation contract', () => {
  it('does not recommend an unversioned registry command', () => {
    expect(readme).not.toMatch(
      /^(?:npm\s+(?:install|i)\s+|npx(?:\s+--yes)?\s+)@invompt\/invoml(?:\s|$)/m,
    )
  })

  it('describes the public alpha channel without internal release narration', () => {
    expect(readme).toContain('InvoML is an alpha release.')
    expect(readme).toContain('Install from the `next` npm tag')
    expect(readme).not.toContain('this source declares')
    expect(readme).not.toContain('`latest` intentionally remains')
  })

  it('uses the explicit next channel for the published prerelease', () => {
    expect(packageJson.version).toBe('1.0.0-alpha.24')
    expect(readme).not.toMatch(
      /(?:npm\s+(?:view|install|i)\s+|npx(?:\s+--yes)?\s+)@invompt\/invoml@\d+\.\d+\.\d+(?:-[^\s`]+)?/m,
    )
    expect(readme).toContain('npx invoml@next validate invoice.json')
  })
})

describe('public README policy regressions', () => {
  const profile = {
    ...profiles.main,
    name: 'fixture README',
    title: /^fixture$/i,
    headings: [],
    links: [{ name: 'required target', pattern: /example\.invalid\/required/i }],
  }

  it('checks visible Markdown link labels and image alt text for English-only prose', () => {
    const errors = validateDocument(
      '# Fixture\n\n[Instalación](https://example.invalid/install)\n\n![Segurança](https://example.invalid/security)',
      'fixture.md',
      profile,
    )

    expect(errors.filter(error => error.code === 'non-english-letter')).toHaveLength(2)
    expect(errors.filter(error => error.code === 'non-english-marker')).toHaveLength(2)
  })

  it('does not satisfy required links from comments, code fences, inline code, or raw URLs', () => {
    const errors = validateDocument(
      '# Fixture\n\n<!-- [required](https://example.invalid/required) -->\n\n```md\n[required](https://example.invalid/required)\n```\n\n`[required](https://example.invalid/required)`\nhttps://example.invalid/required',
      'fixture.md',
      profile,
    )

    expect(errors.map(error => error.code)).toContain('required-link')
  })

  it('accepts a required destination from a visible Markdown link', () => {
    const errors = validateDocument(
      '# Fixture\n\n[Required documentation](https://example.invalid/required)',
      'fixture.md',
      profile,
    )

    expect(errors.map(error => error.code)).not.toContain('required-link')
  })
})
