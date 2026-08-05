import { pathToFileURL } from 'node:url'

const WRITE_PERMISSIONS = new Set(['write', 'admin'])

export function permissionAllowsWrite(permission) {
  return WRITE_PERMISSIONS.has(permission)
}

export function findReleasePull({
  pulls,
  repository,
  defaultBranch,
  commitSha,
}) {
  return pulls.find(pull =>
    pull.merged_at
    && pull.base?.ref === defaultBranch
    && pull.head?.repo?.full_name === repository
    && pull.merge_commit_sha === commitSha
  )
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

  const pulls = []
  for (let page = 1; ; page += 1) {
    const pagePulls = await request(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
        + `/commits/${encodeURIComponent(releaseCommit)}/pulls`
        + `?per_page=100&page=${page}`,
      releaseToken,
    )

    if (!Array.isArray(pagePulls)) {
      throw new Error('GitHub commit pull response must be an array')
    }

    pulls.push(...pagePulls)
    if (pagePulls.length < 100) {
      break
    }
  }

  const releasePull = findReleasePull({
    pulls,
    repository: releaseRepository,
    defaultBranch: releaseBranch,
    commitSha: releaseCommit,
  })

  if (!releasePull) {
    throw new Error(
      `Commit ${releaseCommit} is not the exact merge result `
        + `of a same-repository PR targeting ${releaseBranch}.`,
    )
  }

  log.info(
    `Release lineage verified through PR #${releasePull.number}; `
      + `${releaseActor} has ${actorPermission} permission.`,
  )

  return {
    actorPermission,
    pullNumber: releasePull.number,
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
