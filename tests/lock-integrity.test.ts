import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { assertLockIntegrity } from '../scripts/assert-lock-integrity.mjs'

const lockfile = JSON.parse(
  readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'),
)
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

describe('assertLockIntegrity', () => {
  it('pins the release candidate metadata to alpha.22', () => {
    expect(packageJson.version).toBe('1.0.0-alpha.22')
    expect(lockfile.version).toBe('1.0.0-alpha.22')
    expect(lockfile.packages[''].version).toBe('1.0.0-alpha.22')
  })

  it('accepts the committed package metadata and registry entries', () => {
    expect(assertLockIntegrity({ lockfile, packageJson })).toBeGreaterThan(0)
  })

  it('rejects a lockfile header name or version that differs from package.json', () => {
    const mismatchedName = clone(lockfile)
    mismatchedName.name = 'different-package'
    expect(() => assertLockIntegrity({ lockfile: mismatchedName, packageJson }))
      .toThrow('package-lock.json name must match package.json')

    const mismatchedVersion = clone(lockfile)
    mismatchedVersion.version = '1.0.0-alpha.20'
    expect(() => assertLockIntegrity({ lockfile: mismatchedVersion, packageJson }))
      .toThrow('package-lock.json version must match package.json')
  })

  it('rejects a root package entry name or version that differs from package.json', () => {
    const mismatchedName = clone(lockfile)
    mismatchedName.packages[''].name = 'different-package'
    expect(() => assertLockIntegrity({ lockfile: mismatchedName, packageJson }))
      .toThrow('package-lock.json root package name must match package.json')

    const mismatchedVersion = clone(lockfile)
    mismatchedVersion.packages[''].version = '1.0.0-alpha.20'
    expect(() => assertLockIntegrity({ lockfile: mismatchedVersion, packageJson }))
      .toThrow('package-lock.json root package version must match package.json')
  })
})
