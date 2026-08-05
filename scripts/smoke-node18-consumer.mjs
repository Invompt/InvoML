import assert from 'node:assert/strict'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const tarballArgument = process.argv[2]
if (!tarballArgument) {
  throw new Error(
    'Usage: node scripts/smoke-node18-consumer.mjs <package.tgz>',
  )
}

assert.equal(
  process.versions.node.split('.')[0],
  '18',
  `Consumer smoke must run on Node 18, received ${process.version}`,
)

const tarballPath = resolve(tarballArgument)
const consumerDirectory = mkdtempSync(join(tmpdir(), 'invoml-node18-'))
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: consumerDirectory,
    encoding: 'utf8',
    ...options,
  })

  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(' ')} failed with exit code ${result.status}`,
        result.stdout,
        result.stderr,
      ].filter(Boolean).join('\n'),
    )
  }

  return result
}

try {
  writeFileSync(
    join(consumerDirectory, 'package.json'),
    JSON.stringify({
      name: 'invoml-node18-consumer-smoke',
      private: true,
      type: 'module',
    }),
  )

  run(npmCommand, [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    tarballPath,
    'typescript@5.9.3',
    '@types/node@18.19.130',
  ])

  const smokePath = join(consumerDirectory, 'smoke.mjs')
  writeFileSync(
    smokePath,
    `
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { calculate, parse, toHTML } from 'invoml'
import { calculate as calculateFromSubpath } from 'invoml/calculator'
import { toHTML as toHTMLFromSubpath } from 'invoml/html-renderer'

await Promise.all([
  import('invoml/html-css'),
  import('invoml/types'),
  import('invoml/validator'),
  import('invoml/validation'),
  import('invoml/mutators'),
  import('invoml/format'),
  import('invoml/themes'),
])

const document = {
  $invoml: '1.0',
  meta: {
    documentType: 'invoice',
    number: 'NODE18-001',
    issueDate: '2026-07-26',
    currency: 'USD',
  },
  items: [
    { description: 'Node 18 compatibility', quantity: 2, unitPrice: 100 },
  ],
}

const parsed = parse(JSON.stringify(document))
assert.equal(parsed.success, true)
if (!parsed.success) throw new Error(parsed.errors.join('\\n'))

const totals = calculate(parsed.document)
assert.deepEqual(calculateFromSubpath(parsed.document), totals)
assert.equal(totals.total, 200)

const calculatedDocument = { ...parsed.document, totals }
const html = toHTML(calculatedDocument)
assert.equal(toHTMLFromSubpath(calculatedDocument), html)
assert.match(html, /<!DOCTYPE html>/)
assert.match(html, /NODE18-001/)

const require = createRequire(import.meta.url)
const packageManifest = require('invoml/package.json')
const schema = require('invoml/invoml-v1.0.schema.json')
assert.equal(packageManifest.engines.node, '>=18')
assert.equal(packageManifest.exports['./pdf'], undefined)
assert.equal(packageManifest.dependencies?.['puppeteer-core'], undefined)
assert.equal(packageManifest.peerDependencies?.['puppeteer-core'], undefined)
assert.equal(
  schema.$id,
  'https://github.com/invompt/InvoML/blob/main/invoml-v1.0.schema.json',
)
`,
  )
  run(process.execPath, [smokePath])

  writeFileSync(
    join(consumerDirectory, 'smoke.ts'),
    `
import {
  calculate,
  parse,
  toHTML,
  type InvoMLDocument,
} from 'invoml'

const document: InvoMLDocument = {
  $invoml: '1.0',
  meta: {
    documentType: 'invoice',
    number: 'TS59-NODE18',
    issueDate: '2026-07-26',
    currency: 'USD',
  },
  items: [{ description: 'TypeScript consumer', quantity: 1, unitPrice: 50 }],
}

const parsed = parse(JSON.stringify(document))
if (parsed.success) {
  const calculated = { ...parsed.document, totals: calculate(parsed.document) }
  toHTML(calculated)
}
`,
  )
  writeFileSync(
    join(consumerDirectory, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        noEmit: true,
        strict: true,
        target: 'ES2022',
        types: ['node'],
      },
      include: ['smoke.ts'],
    }),
  )
  const tscPath = join(
    consumerDirectory,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsc.cmd' : 'tsc',
  )
  run(tscPath, [])

  const cliPath = join(
    consumerDirectory,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'invoml.cmd' : 'invoml',
  )
  const fixture = JSON.stringify({
    $invoml: '1.0',
    meta: {
      documentType: 'invoice',
      number: 'NODE18-CLI',
      issueDate: '2026-07-26',
      currency: 'USD',
    },
    items: [{ description: 'CLI smoke', quantity: 1, unitPrice: 25 }],
  })
  const cliResult = run(cliPath, ['validate', '-'], { input: fixture })
  assert.match(cliResult.stdout, /Valid InvoML document\./)

  const installedManifest = JSON.parse(
    readFileSync(
      join(
        consumerDirectory,
        'node_modules',
        '@invompt',
        'invoml',
        'package.json',
      ),
      'utf8',
    ),
  )
  assert.equal(installedManifest.name, 'invoml')

  console.log(
    `Node ${process.versions.node} consumer smoke passed for ${basename(tarballPath)}.`,
  )
} finally {
  rmSync(consumerDirectory, { recursive: true, force: true })
}
