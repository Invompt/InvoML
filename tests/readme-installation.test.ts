import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

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

  it('describes the published prerelease channel without treating latest as current', () => {
    expect(readme).toContain('**Prerelease:** `invoml@1.0.0-alpha.21` is published on the `next` channel.')
    expect(readme).toContain('Install it with\n> `@next` explicitly; `latest` currently points to an older prerelease.')
  })

  it('uses the explicit next channel for the published prerelease', () => {
    expect(packageJson.version).toBe('1.0.0-alpha.21')
    expect(readme).not.toMatch(
      /(?:npm\s+(?:view|install|i)\s+|npx(?:\s+--yes)?\s+)@invompt\/invoml@\d+\.\d+\.\d+(?:-[^\s`]+)?/m,
    )
    expect(readme).toContain('npx invoml@next validate invoice.json')
  })
})
