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

  it('describes the candidate channel without claiming publication from source', () => {
    expect(readme).toContain('**Prerelease:** this source declares `invoml@1.0.0-alpha.23` for the `next` channel.')
    expect(readme).toContain('`latest` intentionally remains on the older')
  })

  it('uses the explicit next channel for the published prerelease', () => {
    expect(packageJson.version).toBe('1.0.0-alpha.23')
    expect(readme).not.toMatch(
      /(?:npm\s+(?:view|install|i)\s+|npx(?:\s+--yes)?\s+)@invompt\/invoml@\d+\.\d+\.\d+(?:-[^\s`]+)?/m,
    )
    expect(readme).toContain('npx invoml@next validate invoice.json')
  })
})
