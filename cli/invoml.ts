#!/usr/bin/env node
import { readFileSync } from 'fs'
import { parse } from '../src/parser.js'
import { calculate } from '../src/calculator.js'
import { validateSchema } from '../src/schema.js'
import { validate } from '../src/validation.js'
import { toJSON, toMarkdown } from '../src/serializer.js'
import { toHTML, type RenderOptions } from '../src/html-renderer.js'

const USAGE = `Usage: invoml <validate|calculate|serialize|html> [file.json | -] [options]
Options (html):
  --theme <name>        Theme preset (standard, slate, ember, forest, violet, mono, editorial)
  --custom-css <file>   CSS file appended as the last style layer`

function exitWithErrors(label: string, errors: string[]): never {
  console.error(`${label}:`)
  errors.forEach(e => console.error(`  - ${e}`))
  process.exit(1)
}

function readInput(file: string | undefined): string {
  if (file === '-' || (!file && !process.stdin.isTTY)) {
    try {
      return readFileSync(0, 'utf8')
    } catch (e) {
      console.error(`Error reading from stdin: ${(e as Error).message}`)
      process.exit(1)
    }
  } else if (file) {
    try {
      return readFileSync(file, 'utf8')
    } catch (e) {
      console.error(`Error reading file "${file}": ${(e as Error).message}`)
      process.exit(1)
    }
  }
  console.log(USAGE)
  process.exit(1)
}

function parseOrExit(content: string) {
  const result = parse(content)
  if (!result.success) exitWithErrors('Parse errors', result.errors)
  return result.document
}

function formatValidationIssue(issue: { level: 'error' | 'warning'; path: string; code: string; message: string }): string {
  return `[${issue.level}] ${issue.path} (${issue.code}): ${issue.message}`
}

interface CliFlags {
  theme?: string
  customCssFile?: string
}

function parseArgs(argv: string[]): { command?: string; positional: string[]; flags: CliFlags } {
  const [, , command, ...rest] = argv
  const positional: string[] = []
  const flags: CliFlags = {}
  let i = 0
  const takeValue = (name: string): string => {
    i++
    const value = rest[i]
    if (value === undefined) {
      console.error(`Missing value for ${name}`)
      process.exit(1)
    }
    return value
  }
  while (i < rest.length) {
    const arg = rest[i]
    if (arg === '--theme') flags.theme = takeValue(arg)
    else if (arg === '--custom-css') flags.customCssFile = takeValue(arg)
    else positional.push(arg)
    i++
  }
  return { command, positional, flags }
}

function buildRenderOptions(flags: CliFlags): RenderOptions {
  const options: RenderOptions = {}
  if (flags.theme) options.theme = flags.theme
  if (flags.customCssFile) {
    try {
      options.customCss = readFileSync(flags.customCssFile, 'utf8')
    } catch (e) {
      console.error(`Error reading CSS file "${flags.customCssFile}": ${(e as Error).message}`)
      process.exit(1)
    }
  }
  return options
}

const { command, positional, flags } = parseArgs(process.argv)
const [file, legacyFormat] = positional

if (!command) {
  console.log(USAGE)
  process.exit(1)
}

const content = readInput(file)

if (command === 'validate') {
  let doc: unknown
  try {
    doc = JSON.parse(content)
  } catch (e) {
    console.error(`Invalid JSON in "${file}": ${(e as Error).message}`)
    process.exit(1)
  }
  const result = validateSchema(doc)
  if (!result.valid) {
    exitWithErrors('Schema validation errors', result.errors)
  }

  const domainResult = validate(doc as Parameters<typeof validate>[0])
  const errorIssues = domainResult.issues.filter(issue => issue.level === 'error')
  const warningIssues = domainResult.issues.filter(issue => issue.level === 'warning')

  if (errorIssues.length > 0) {
    exitWithErrors('Validation issues', domainResult.issues.map(formatValidationIssue))
  }

  if (warningIssues.length > 0) {
    console.log('Valid InvoML document with warnings:')
    warningIssues.forEach(issue => console.log(`  - ${formatValidationIssue(issue)}`))
    process.exit(0)
  }

  console.log('Valid InvoML document.')
} else if (command === 'calculate') {
  const doc = parseOrExit(content)
  console.log(JSON.stringify(calculate(doc), null, 2))
} else if (command === 'serialize') {
  const parsed = parseOrExit(content)
  const doc = { ...parsed, totals: calculate(parsed) }
  if (legacyFormat === 'md' || legacyFormat === 'markdown') {
    console.log(toMarkdown(doc))
  } else {
    console.log(toJSON(doc))
  }
} else if (command === 'html') {
  const parsed = parseOrExit(content)
  const doc = { ...parsed, totals: calculate(parsed) }
  console.log(toHTML(doc, buildRenderOptions(flags)))
} else {
  console.error(`Unknown command: ${command}`)
  process.exit(1)
}
