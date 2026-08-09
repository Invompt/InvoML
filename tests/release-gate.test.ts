import { describe, expect, it, vi } from 'vitest'
import { permissionAllowsWrite, runReleaseGate } from '../scripts/release-gate.mjs'

type Comparison = {
  status: string
  base_commit: { sha: string }
  merge_base_commit: { sha: string }
}

type GateOptions = {
  permission?: string
  comparison?: Comparison
  repository?: string
  commitSha?: string
  defaultBranch?: string
}

function compareResponse(overrides: Partial<Comparison> = {}) {
  return {
    status: 'ahead',
    base_commit: { sha: 'merge-sha' },
    merge_base_commit: { sha: 'merge-sha' },
    ...overrides,
  }
}

async function executeGate({
  permission = 'write',
  comparison = compareResponse(),
  repository = 'Invompt/InvoML',
  commitSha = 'merge-sha',
  defaultBranch = 'main',
}: GateOptions = {}) {
  const requests: string[] = []

  const request = vi.fn(async (path: string, token: string) => {
    requests.push(path)
    expect(token).toBe('test-token')

    if (path.endsWith('/permission')) {
      return { permission }
    }

    if (path.includes('/compare/')) {
      return comparison
    }

    throw new Error(`Unexpected request: ${path}`)
  })

  const log = { info: vi.fn() }

  const result = await runReleaseGate({
    token: 'test-token',
    repository,
    actor: 'release-actor',
    commitSha,
    defaultBranch,
    request,
    log,
  })

  return { log, requests, result }
}

describe('release lineage gate executable', () => {
  it.each([
    ['GITHUB_TOKEN', { token: '' }],
    ['GITHUB_REPOSITORY', { repository: '' }],
    ['GITHUB_ACTOR', { actor: '' }],
    ['COMMIT_SHA', { commitSha: '' }],
    ['DEFAULT_BRANCH', { defaultBranch: '' }],
  ])('fails closed when %s is missing', async (name, overrides) => {
    await expect(
      runReleaseGate({
        token: 'test-token',
        repository: 'Invompt/InvoML',
        actor: 'release-actor',
        commitSha: 'merge-sha',
        defaultBranch: 'main',
        request: vi.fn(),
        log: { info: vi.fn() },
        ...overrides,
      }),
    ).rejects.toThrow(`${name} is required`)
  })

  it('accepts commit that is on the default-branch ancestry', async () => {
    const { result, requests } = await executeGate()

    expect(result).toEqual({
      actorPermission: 'write',
      branch: 'main',
      comparison: 'ahead',
    })
    expect(requests).toEqual([
      '/repos/Invompt/InvoML/collaborators/release-actor/permission',
      '/repos/Invompt/InvoML/compare/merge-sha...main',
    ])
    expect(result.branch).toBe('main')
  })

  it('accepts an exact identical head comparison', async () => {
    const comparison = compareResponse({
      status: 'identical',
      base_commit: { sha: 'merge-sha' },
      merge_base_commit: { sha: 'merge-sha' },
    })
    await expect(
      executeGate({ comparison }),
    ).resolves.toMatchObject({
      result: { actorPermission: 'write', branch: 'main', comparison: 'identical' },
    })
  })

  it('rejects a commit that is not the default-branch comparison head', async () => {
    const comparison = compareResponse({
      status: 'ahead',
      base_commit: { sha: 'other-sha' },
    })
    await expect(
      executeGate({ comparison }),
    ).rejects.toThrow('is not the compared commit on main or a verified ancestor of its current head')
  })

  it('rejects a comparison without acceptable status', async () => {
    const comparison = compareResponse({ status: 'behind' })
    await expect(
      executeGate({ comparison }),
    ).rejects.toThrow('is not the compared commit on main or a verified ancestor of its current head')
  })

  it.each(['none', 'read'])(
    'rejects an actor with %s permission before checking ancestry',
    async permission => {
      await expect(
        executeGate({ permission }),
      ).rejects.toThrow(/write or admin is required/)
    },
  )

  it.each(['write', 'admin'])(
    'accepts an actor with %s permission',
    async permission => {
      await expect(
        executeGate({ permission }),
      ).resolves.toMatchObject({ result: { actorPermission: permission, branch: 'main' } })
    },
  )

  it('rejects an invalid repository identity before making requests', async () => {
    await expect(
      executeGate({ repository: 'invalid' }),
    ).rejects.toThrow(/owner\/repo format/)
  })

  it.each([
    ['none', false],
    ['read', false],
    ['write', true],
    ['admin', true],
  ])('maps the %s permission tier to eligible=%s', (permission, expected) => {
    expect(permissionAllowsWrite(permission)).toBe(expected)
  })
})
