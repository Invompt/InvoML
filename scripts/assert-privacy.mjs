import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const allowlist = JSON.parse(
  readFileSync(new URL('./privacy-allowlist.json', import.meta.url), 'utf8'),
)

assert.ok(Array.isArray(allowlist.entries), 'privacy allowlist entries must be an array')
for (const entry of allowlist.entries) {
  assert.equal(typeof entry.rule, 'string', 'privacy allowlist entry rule must be a string')
  assert.equal(typeof entry.path, 'string', 'privacy allowlist entry path must be a string')
  assert.equal(typeof entry.reason, 'string', 'privacy allowlist entry reason must be a string')
  assert.ok(entry.reason.trim().length > 0, 'privacy allowlist entry reason must not be empty')
  assert.match(entry.sha256, /^[0-9a-f]{64}$/, 'privacy allowlist entry sha256 must be a SHA-256 digest')
}

const joinedPattern = (parts, flags = 'i') => new RegExp(parts.join(''), flags)

const rules = [
  { id: 'private-key', expression: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/ },
  { id: 'github-token', expression: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
  { id: 'gitlab-token', expression: /glpat-[A-Za-z0-9_-]{20,}/ },
  { id: 'npm-token', expression: /npm_[A-Za-z0-9]{20,}/ },
  { id: 'slack-token', expression: /xox[baprs]-[A-Za-z0-9-]{20,}/ },
  { id: 'aws-access-key', expression: /AKIA[0-9A-Z]{16}/ },
  { id: 'aws-secret-assignment', expression: /aws_secret_access_key\s*[:=]\s*['"][^'"\s]{20,}/i },
  { id: 'authorization-bearer', expression: /authorization\s*[:=]\s*['"]?bearer\s+[A-Za-z0-9._~+/=-]{20,}/i },
  {
    id: 'unapproved-email-domain',
    expression: /\b(?!hello@invompt\.com\b)[A-Z0-9._%+-]+@(?![A-Z0-9.-]+\.example\.invalid\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  },
  {
    id: 'incomplete-reserved-email-domain',
    expression: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.example\b(?!\.invalid)/i,
  },
  {
    id: 'fixture-party-or-address',
    expression: joinedPattern([
      '\\b(?:',
      ['Ac', 'me', '|Glo', 'bex', '|Jane', ' Dev', '|Müller', ' GmbH', '|Treuhand', ' AG',
        '|Dupont', ' SAS', '|Tech Solutions', ' Pvt Ltd', '|Aussie Supplies', ' Pty Ltd',
        '|UK Agency', ' Ltd', '|Client', ' Inc', '|First', ' National', '|Studio', ' Craft',
        '|Client', ' GmbH', '|123', ' Main St', '|456', ' Oak Ave', '|100', ' Commerce St',
        '|Midori', ' Café', '|Corner', ' Shop', '|Buyer', ' Co', '|Client', ' Co',
        '|Visible', ' Customer', '|New', ' York'].join(''),
      ')\\b',
    ]),
  },
  {
    id: 'owner-or-private-product-data',
    expression: joinedPattern([
      '\\b(?:',
      ['Ari', 'el', '|Mar', 'ti', '|Tradi', 'fy', '|E', 'VO', '|N', 'ZD', '|New Zealand', ' dollar'].join(''),
      ')\\b',
    ]),
  },
  {
    id: 'structured-financial-fixture',
    include: /^(?:tests|examples|test-vectors|docs)\//,
    expression: /["']?(?:iban|routingNumber|accountNumber|taxId|businessNumber|swift|cryptoAddress)["']?\s*:\s*["'](?!EXAMPLE|NOT-A-REAL)[^"']+["']/,
  },
  {
    id: 'hourly-billing-fixture',
    include: /^(?:README\.md|docs\/|examples\/|test-vectors\/|tests\/)/,
    expression: /(?:\b(?:hourly|hours?|hrs)\b|\$\d+(?:\.\d+)?\/hr\b|["']?unit["']?\s*:\s*["'](?:h|hr|hrs|hour|hours|Std)["'])/i,
  },
  {
    id: 'professional-service-description-fixture',
    include: /^(?:README\.md|docs\/|examples\/|test-vectors\/|tests\/)/,
    expression: /["']?description["']?\s*:\s*["'][^"']*\b(?:consult(?:ing|oria)?|development|design|professional services?|training|assessment|analysis report|research report)\b/i,
  },
  {
    id: 'generic-party-fixture',
    include: /^(?:examples|test-vectors|tests)\//,
    expression: /\bEXAMPLE(?: [A-Z-]+){0,4} (?:ISSUER|RECIPIENT|SELLER|BUYER|CUSTOMER|SUPPLIER|CLIENT|BUSINESS|BENEFICIARY|WORKS|CAFE|SHOP|KIOSK|NAME)(?: [A-Z])?\b/,
  },
  {
    id: 'non-invalid-reserved-test-url',
    include: /^tests\//,
    expression: /https?:\/\/example\.com\b/i,
  },
  {
    id: 'local-user-path',
    expression: joinedPattern(['/', 'Users', '/[A-Za-z0-9._-]+(?:/|\\b)']),
  },
]

function usage() {
  throw new Error(
    'Usage: node scripts/assert-privacy.mjs (--source <tree> | --tree <tree> | --pack-report <npm-pack-report.json>)',
  )
}

function relativePath(target) {
  const path = relative(root, target)
  return path.startsWith(`..${sep}`) ? target : path || '.'
}

function isAllowed(rule, path, match) {
  const sha256 = createHash('sha256').update(match).digest('hex')
  return allowlist.entries.some(entry =>
    entry.rule === rule && entry.path === path && entry.sha256 === sha256,
  )
}

function assertSafePath(path) {
  const normalized = path.replaceAll('\\', '/')
  assert.equal(normalized.includes('..'), false, 'Privacy scan path must not traverse parents')
  assert.equal(/(?:^|\/)(?:\.env(?:\.|$)|id_rsa(?:\.pub)?$)/i.test(normalized), false,
    `Privacy scan found a sensitive file name: ${normalized}`)
  assert.equal(normalized.endsWith('.map'), false, `Privacy scan found a source map: ${normalized}`)
  assert.equal(joinedPattern(['(?:^|/)(?:', ['ari', 'el', '|mar', 'ti', '|tradi', 'fy', '|ac', 'me', '|glo', 'bex'].join(''), ')(?:/|$)']).test(normalized), false,
    `Privacy scan found a sensitive fixture name in a file path: ${normalized}`)
}

function scanText(path, text) {
  for (const rule of rules) {
    if (rule.include && !rule.include.test(path)) continue
    const match = rule.expression.exec(text)
    if (match && !isAllowed(rule.id, path, match[0])) {
      throw new Error(`Privacy scan found ${rule.id} in ${path}; matched values are intentionally redacted.`)
    }
  }
}

function scanFile(target) {
  const path = relativePath(target)
  assertSafePath(path)
  const content = readFileSync(target)
  if (content.includes(0)) return
  scanText(path, content.toString('utf8'))
}

function scanTree(target, options = {}) {
  const stat = lstatSync(target)
  if (stat.isSymbolicLink()) {
    throw new Error(`Privacy scan does not follow symbolic links: ${relativePath(target)}`)
  }
  if (stat.isFile()) return scanFile(target)
  assert.ok(stat.isDirectory(), `Privacy scan target must be a file or directory: ${relativePath(target)}`)

  for (const entry of readdirSync(target, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue
    if (options.excludeGenerated && ['coverage', 'dist', 'release'].includes(entry.name)) continue
    scanTree(resolve(target, entry.name), options)
  }
}

function scanPackReport(reportPath) {
  const reports = JSON.parse(readFileSync(reportPath, 'utf8'))
  assert.equal(reports.length, 1, 'npm pack report must describe exactly one package')
  for (const file of reports[0].files ?? []) {
    assert.equal(typeof file.path, 'string', 'npm pack report file path must be a string')
    assertSafePath(file.path)
  }
}

const [mode, target] = process.argv.slice(2)
if (!target || !['--source', '--tree', '--pack-report'].includes(mode)) usage()

if (mode === '--pack-report') {
  scanPackReport(resolve(target))
} else {
  scanTree(resolve(target), { excludeGenerated: mode === '--source' })
}

console.log(`Privacy scan passed for ${mode}.`)
