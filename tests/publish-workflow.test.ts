import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const workflow = readFileSync(
  new URL('../.github/workflows/trusted-publish.yml', import.meta.url),
  'utf8',
)
const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { repository?: { url?: string } }

function jobBlock(name: string, nextName?: string) {
  const startMarker = `\n  ${name}:\n`
  const start = workflow.indexOf(startMarker)
  expect(start).toBeGreaterThan(-1)

  if (!nextName) return workflow.slice(start)

  const end = workflow.indexOf(`\n  ${nextName}:\n`, start + startMarker.length)
  expect(end).toBeGreaterThan(start)
  return workflow.slice(start, end)
}

const buildJob = jobBlock('validate-build', 'publish')
const publishJob = jobBlock('publish')

describe('trusted publishing workflow security invariants', () => {
  it('matches the exact GitHub repository identity required by npm provenance', () => {
    expect(packageJson.repository?.url).toBe('https://github.com/Invompt/InvoML')
  })

  it('has one exact immutable prerelease tag trigger and rejects private repositories', () => {
    expect(workflow).toContain('name: Trusted Publish')
    expect(workflow).toContain("- 'v1.0.0-alpha.23'")
    expect(workflow).not.toContain("- 'v*'")
    expect(workflow).not.toContain('workflow_dispatch')
    expect(buildJob).toContain("github.ref == 'refs/tags/v1.0.0-alpha.23'")
    expect(buildJob).toContain('github.event.repository.private == false')
    expect(buildJob).toContain('test "$REF" = refs/tags/v1.0.0-alpha.23')
    expect(buildJob).toContain('test "$REPOSITORY_PRIVATE" = false')
    expect(buildJob).toContain('test "$PACKAGE_VERSION" = 1.0.0-alpha.23')
  })

  it('uses the exact reviewed Node and npm versions', () => {
    expect(workflow.match(/node-version: 22\.22\.0/g)).toHaveLength(2)
    expect(workflow.match(/npm install --global npm@11\.11\.0 --ignore-scripts/g)).toHaveLength(2)
    expect(buildJob).toContain('test "$(node --version)" = v22.22.0')
    expect(buildJob).toContain('test "$(npm --version)" = 11.11.0')
    expect(publishJob).toContain('test "$(node --version)" = v22.22.0')
    expect(publishJob).toContain('test "$(npm --version)" = 11.11.0')
  })

  it('limits OIDC and the npm environment to the isolated publish job', () => {
    expect(workflow).toContain('permissions: {}')
    expect(workflow.match(/id-token: write/g)).toHaveLength(1)
    expect(buildJob).not.toContain('id-token:')
    expect(publishJob).toContain('environment: npm')
    expect(publishJob).not.toContain('contents:')
    expect(publishJob).toContain('id-token: write')
  })

  it('builds a tested artifact and verifies its GitHub digest plus exact SHA256', () => {
    expect(buildJob).toContain('npm run check:lock')
    expect(buildJob).toContain('npm ci')
    expect(buildJob).toContain('npm run build')
    expect(buildJob).toContain('npm test')
    expect(buildJob).toContain('npm run check:privacy')
    expect(buildJob).toContain('node scripts/assert-privacy.mjs --pack-report package-pack.json')
    expect(buildJob).toContain('node scripts/assert-privacy.mjs --tree release/unpacked/package')
    expect(buildJob).toContain('node scripts/assert-package.mjs package-pack.json')
    expect(buildJob).toContain('artifact-digest')
    expect(buildJob).toContain('tarball-sha256')
    expect(publishJob).toContain('digest-mismatch: error')
    expect(publishJob).toContain('ARTIFACT_DIGEST')
    expect(publishJob).toContain('sha256sum --check')
    expect(publishJob).toContain('assert.deepEqual')
    expect(publishJob).toContain('test "$PACKAGE_VERSION" = 1.0.0-alpha.23')
    expect(buildJob).toContain('node scripts/release-gate.mjs')
    expect(buildJob).toContain('env:')
    expect(buildJob).toContain('GITHUB_TOKEN: ${{ github.token }}')
    expect(buildJob).toContain('GITHUB_REPOSITORY: ${{ github.repository }}')
    expect(buildJob).toContain('GITHUB_ACTOR: ${{ github.actor }}')
    expect(buildJob).toContain('COMMIT_SHA: ${{ steps.release.outputs.commit-sha }}')
    expect(buildJob).toContain('DEFAULT_BRANCH: ${{ github.event.repository.default_branch }}')
  })

  it('keeps checkout, project dependencies, and repository scripts out of publishing', () => {
    expect(publishJob).not.toContain('actions/checkout')
    expect(publishJob).not.toMatch(/\bnpm (?:ci|pack|run|test)\b/)
    expect(publishJob).not.toContain('node scripts/')
    expect(publishJob).not.toContain('package.json')
    expect(publishJob).not.toMatch(/\b(?:NODE_AUTH_TOKEN|NPM_TOKEN|GITHUB_TOKEN|SECRET)\b/)
  })

  it('uses tokenless OIDC publishing for only the next prerelease channel', () => {
    expect(publishJob).toContain('npm publish "./${{ steps.verify.outputs.tarball }}"')
    expect(publishJob).toContain('--access public')
    expect(publishJob).toContain('--tag next')
    expect(publishJob).toContain('--ignore-scripts')
    expect(workflow).not.toContain('--provenance')
    expect(workflow).not.toMatch(/\bnpm stage\b/)
    expect(workflow).not.toMatch(/\bapprove\b/i)
    expect(workflow).not.toContain('--tag latest')
  })

  it('pins every third-party action to a full commit SHA', () => {
    const uses = [...workflow.matchAll(/uses: [^@\n]+@([^\s]+)/g)]
    expect(uses.length).toBeGreaterThan(0)
    for (const match of uses) {
      expect(match[1]).toMatch(/^[0-9a-f]{40}$/)
    }
  })
})
