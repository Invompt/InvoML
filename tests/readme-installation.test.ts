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

  it('describes the candidate as development-only without production or publication claims', () => {
    expect(readme).toContain('### Development availability')
    expect(readme).toContain('does not make a public registry')
    expect(readme).toContain('production, or installation claim')
    expect(readme).toContain('owner-authorized development channel')
    expect(readme).toContain('do not substitute `latest`')
  })

  it('permits only the explicit next development channel before external verification', () => {
    expect(packageJson.version).toBe('1.0.0-alpha.21')
    expect(readme).not.toMatch(
      /(?:npm\s+(?:view|install|i)\s+|npx(?:\s+--yes)?\s+)@invompt\/invoml@\d+\.\d+\.\d+(?:-[^\s`]+)?/m,
    )
    expect(readme).toContain('`npx invoml@next ...`')
  })
})
