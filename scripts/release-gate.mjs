import { pathToFileURL } from 'node:url'

const WRITE_PERMISSIONS = new Set(['write', 'admin'])

export function permissionAllowsWrite(permission) {
  return WRITE_PERMISSIONS.has(permission)
}

export function commitBelongsToDefaultBranch(compare, commitSha) {
  return ['ahead', 'identical'].includes(compare?.status)
    && compare?.base_commit?.sha === commitSha
    && compare?.merge_base_commit?.sha === commitSha
}

async function githubRequest(path, token) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(
      `GitHub API ${path} returned ${response.status}: ${detail.slice(0, 500)}`,
    )
  }

  return response.json()
}

function requireValue(value, name) {
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

export async function runReleaseGate({
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY,
  actor = process.env.GITHUB_ACTOR,
  commitSha = process.env.COMMIT_SHA,
  defaultBranch = process.env.DEFAULT_BRANCH,
  request = githubRequest,
  log = console,
} = {}) {
  const releaseToken = requireValue(token, 'GITHUB_TOKEN')
  const releaseRepository = requireValue(repository, 'GITHUB_REPOSITORY')
  const releaseActor = requireValue(actor, 'GITHUB_ACTOR')
  const releaseCommit = requireValue(commitSha, 'COMMIT_SHA')
  const releaseBranch = requireValue(defaultBranch, 'DEFAULT_BRANCH')
  const [owner, repo, extra] = releaseRepository.split('/')

  if (!owner || !repo || extra) {
    throw new Error('GITHUB_REPOSITORY must use owner/repo format')
  }

  const permissionResponse = await request(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
      + `/collaborators/${encodeURIComponent(releaseActor)}/permission`,
    releaseToken,
  )
  const actorPermission = permissionResponse.permission

  if (!permissionAllowsWrite(actorPermission)) {
    throw new Error(
      `${releaseActor} has ${actorPermission ?? 'unknown'} permission; `
        + 'write or admin is required.',
    )
  }

  const comparison = await request(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
      + `/compare/${encodeURIComponent(releaseCommit)}...${encodeURIComponent(releaseBranch)}`,
    releaseToken,
  )

  if (!commitBelongsToDefaultBranch(comparison, releaseCommit)) {
    throw new Error(
      `Commit ${releaseCommit} is not the compared commit on ${releaseBranch} `
        + 'or a verified ancestor of its current head.',
    )
  }

  log.info(
    `Release lineage verified on ${releaseBranch}; `
      + `${releaseActor} has ${actorPermission} permission and comparison is ${comparison.status}.`,
  )

  return {
    actorPermission,
    branch: releaseBranch,
    comparison: comparison.status,
  }
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  runReleaseGate().catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
