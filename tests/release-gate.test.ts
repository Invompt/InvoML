import { describe, expect, it, vi } from 'vitest'
import {
  findReleasePull,
  permissionAllowsWrite,
  runReleaseGate,
} from '../scripts/release-gate.mjs'

type PullOptions = {
  mergedAt?: string | null
  base?: string
  headRepository?: string
  mergeCommitSha?: string
  number?: number
}

type GateOptions = {
  permission?: string
  pulls?: ReturnType<typeof pull>[]
  repository?: string
}

function pull({
  mergedAt = '2026-07-27T00:00:00Z',
  base = 'main',
  headRepository = 'Invompt/InvoML',
  mergeCommitSha = 'merge-sha',
  number = 14,
}: PullOptions = {}) {
  return {
    merged_at: mergedAt,
    base: { ref: base },
    head: { repo: { full_name: headRepository } },
    merge_commit_sha: mergeCommitSha,
    number,
  }
}

function releasePull(pulls = [pull()]) {
  return findReleasePull({
    pulls,
    repository: 'Invompt/InvoML',
    defaultBranch: 'main',
    commitSha: 'merge-sha',
  })
}

async function executeGate({
  permission = 'write',
  pulls = [pull()],
  repository = 'Invompt/InvoML',
}: GateOptions = {}) {
  const requests: string[] = []
  const request = vi.fn(async (path: string, token: string) => {
    requests.push(path)
    expect(token).toBe('test-token')
    if (path.endsWith('/permission')) {
      return { permission }
    }
    if (path.includes('/commits/merge-sha/pulls')) {
      return pulls
    }
    throw new Error(`Unexpected request: ${path}`)
  })
  const log = { info: vi.fn() }
  const result = await runReleaseGate({
    token: 'test-token',
    repository,
    actor: 'release-actor',
    commitSha: 'merge-sha',
    defaultBranch: 'main',
    request,
    log,
  })

  return { log, requests, result }
}

describe('release lineage gate executable', () => {
  it('accepts the exact merge result of a same-repository PR to main', async () => {
    const { log, requests, result } = await executeGate()

    expect(result).toEqual({
      actorPermission: 'write',
      pullNumber: 14,
    })
    expect(requests).toEqual([
      '/repos/Invompt/InvoML/collaborators/release-actor/permission',
      '/repos/Invompt/InvoML/commits/merge-sha/pulls?per_page=100&page=1',
    ])
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining('Release lineage verified through PR #14'),
    )
  })

  it('rejects an unmerged PR', async () => {
    await expect(
      executeGate({ pulls: [pull({ mergedAt: null })] }),
    ).rejects.toThrow(/not the exact merge result/)
  })

  it('rejects a PR targeting the wrong base', async () => {
    await expect(
      executeGate({ pulls: [pull({ base: 'staging' })] }),
    ).rejects.toThrow(/not the exact merge result/)
  })

  it('rejects a PR from another repository', async () => {
    await expect(
      executeGate({ pulls: [pull({ headRepository: 'attacker/InvoML' })] }),
    ).rejects.toThrow(/not the exact merge result/)
  })

  it('rejects a PR whose merge result is not the staged commit', async () => {
    await expect(
      executeGate({ pulls: [pull({ mergeCommitSha: 'different-sha' })] }),
    ).rejects.toThrow(/not the exact merge result/)
  })

  it('rejects a direct-main commit with no merged PR lineage', async () => {
    await expect(executeGate({ pulls: [] })).rejects.toThrow(
      /not the exact merge result/,
    )
  })

  it.each(['none', 'read'])(
    'rejects an actor with %s permission before reading PR lineage',
    async permission => {
      await expect(executeGate({ permission })).rejects.toThrow(
        /write or admin is required/,
      )
    },
  )

  it.each(['write', 'admin'])(
    'accepts an actor with %s permission',
    async permission => {
      await expect(executeGate({ permission })).resolves.toMatchObject({
        result: { actorPermission: permission },
      })
    },
  )

  it('rejects an invalid repository identity before making a request', async () => {
    await expect(executeGate({ repository: 'invalid' })).rejects.toThrow(
      /owner\/repo format/,
    )
  })

  it('paginates associated PRs before matching exact lineage', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      pull({
        base: 'staging',
        mergeCommitSha: `other-${index}`,
        number: index + 1,
      }),
    )
    const request = vi
      .fn()
      .mockResolvedValueOnce({ permission: 'admin' })
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([pull({ number: 101 })])

    await expect(
      runReleaseGate({
        token: 'test-token',
        repository: 'Invompt/InvoML',
        actor: 'release-actor',
        commitSha: 'merge-sha',
        defaultBranch: 'main',
        request,
        log: { info: vi.fn() },
      }),
    ).resolves.toEqual({
      actorPermission: 'admin',
      pullNumber: 101,
    })
    expect(request).toHaveBeenCalledTimes(3)
  })

  it.each([
    ['none', false],
    ['read', false],
    ['write', true],
    ['admin', true],
  ])('maps the %s permission tier to eligible=%s', (permission, expected) => {
    expect(permissionAllowsWrite(permission)).toBe(expected)
  })

  it('keeps the pure lineage matcher aligned with the executable', () => {
    expect(releasePull()?.number).toBe(14)
  })
})
