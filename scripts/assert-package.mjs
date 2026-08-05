import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const reportPath = process.argv[2]
if (!reportPath) {
  throw new Error('Usage: node scripts/assert-package.mjs <npm-pack-report.json>')
}

const reports = JSON.parse(readFileSync(reportPath, 'utf8'))
assert.equal(reports.length, 1, 'npm pack must produce exactly one package')

const [report] = reports
if (report.error) {
  throw new Error(`npm pack failed: ${report.error.message}`)
}

const packagePaths = report.files.map(file => file.path).sort()
const reviewedPaths = [
  'LICENSE',
  'README.md',
  'invoml-v1.0.schema.json',
  'package.json',
  'dist/cli/invoml.d.ts',
  'dist/cli/invoml.js',
  'dist/src/calculator.d.ts',
  'dist/src/calculator.js',
  'dist/src/date.d.ts',
  'dist/src/date.js',
  'dist/src/discounts.d.ts',
  'dist/src/discounts.js',
  'dist/src/document-preparation.d.ts',
  'dist/src/document-preparation.js',
  'dist/src/editable.d.ts',
  'dist/src/editable.js',
  'dist/src/format.d.ts',
  'dist/src/format.js',
  'dist/src/html-css.d.ts',
  'dist/src/html-css.js',
  'dist/src/html-output.d.ts',
  'dist/src/html-output.js',
  'dist/src/html-renderer.d.ts',
  'dist/src/html-renderer.js',
  'dist/src/index.d.ts',
  'dist/src/index.js',
  'dist/src/locale.d.ts',
  'dist/src/locale.js',
  'dist/src/markdown-output.d.ts',
  'dist/src/markdown-output.js',
  'dist/src/markdown.d.ts',
  'dist/src/markdown.js',
  'dist/src/mutators.d.ts',
  'dist/src/mutators.js',
  'dist/src/parser.d.ts',
  'dist/src/parser.js',
  'dist/src/presentation-internal.d.ts',
  'dist/src/presentation-internal.js',
  'dist/src/presentation.d.ts',
  'dist/src/presentation.js',
  'dist/src/render-options.d.ts',
  'dist/src/render-options.js',
  'dist/src/render-shared.d.ts',
  'dist/src/render-shared.js',
  'dist/src/rounding.d.ts',
  'dist/src/rounding.js',
  'dist/src/schema.d.ts',
  'dist/src/schema.js',
  'dist/src/serializer.d.ts',
  'dist/src/serializer.js',
  'dist/src/style.d.ts',
  'dist/src/style.js',
  'dist/src/tax.d.ts',
  'dist/src/tax.js',
  'dist/src/themes.d.ts',
  'dist/src/themes.js',
  'dist/src/types.d.ts',
  'dist/src/types.js',
  'dist/src/validation.d.ts',
  'dist/src/validation.js',
  'dist/src/validator.d.ts',
  'dist/src/validator.js',
].sort()

assert.deepEqual(
  packagePaths,
  reviewedPaths,
  'Packed package contents differ from the exact reviewed allowlist',
)
assert.equal(
  packagePaths.some(path => path.endsWith('.map')),
  false,
  'Packed package must not include source maps',
)

console.log(`Package contents verified (${packagePaths.length} files).`)
