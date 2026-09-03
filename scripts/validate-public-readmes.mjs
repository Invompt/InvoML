#!/usr/bin/env node

/**
 * Keep the public README surfaces concise, English-only, and free of private
 * development details. This intentionally uses only Node's standard library
 * so it can run before dependencies are installed.
 */

import { readFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))

const profiles = {
  main: {
    name: 'main README',
    path: 'README.md',
    maxLines: 150,
    maxLineLength: 180,
    title: /^invoml$/i,
    headings: [
      /why\s+invoml/i,
      /installation/i,
      /quick\s+start/i,
      /core\s+api/i,
      /documentation/i,
      /security/i,
      /contributing/i,
      /license/i,
    ],
    links: [
      { name: 'npm package', pattern: /https?:\/\/www\.npmjs\.com\/package\/invoml/i },
      { name: 'specification', pattern: /github\.com\/Invompt\/InvoML\/blob\/main\/SPEC\.md/i },
      { name: 'JSON Schema', pattern: /github\.com\/Invompt\/InvoML\/blob\/main\/invoml-v1\.0\.schema\.json/i },
      { name: 'security policy', pattern: /github\.com\/Invompt\/InvoML\/blob\/main\/SECURITY\.md/i },
      { name: 'contributing guide', pattern: /github\.com\/Invompt\/InvoML\/blob\/main\/CONTRIBUTING\.md/i },
      { name: 'license', pattern: /^LICENSE$/i },
    ],
  },
  example: {
    name: 'multi-format example README',
    path: 'examples/multi-format/README.md',
    maxLines: 40,
    maxLineLength: 180,
    title: /^multi[- ]format\s+example$/i,
    headings: [],
    links: [
      { name: 'main README', pattern: /^\.\.\/\.\.\/README\.md$/i },
      { name: 'rendering guide', pattern: /^\.\.\/\.\.\/docs\/RENDERING\.md$/i },
    ],
  },
}

// These are intentionally shape-based. They catch accidentally copied private
// setup or credential examples without rejecting ordinary words such as "data".
const forbiddenPatterns = [
  { code: 'internal-runtime', pattern: /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0|staging|supabase|maintainer[- ]only|internal|guest\s+runtime)\b/i, message: 'contains an internal runtime or environment reference' },
  { code: 'internal-configuration', pattern: /(?:\bMCP_PRODUCT_URL\b|\bSUPABASE_[A-Z_]+\b|invompt:\/\/|\/Users\/|\/home\/|\.env(?:\b|\.))/i, message: 'contains an internal configuration or local path' },
  { code: 'release-process', pattern: /\b(?:release[- ](?:gate|process)|trusted[- ]publishing|npm\s+publish|dist[- ]tag|candidate\s+release)\b/i, message: 'contains release-process narration' },
  { code: 'pinned-internal-runtime', pattern: /\b(?:node(?:\.js)?\s*v?22\.22\.0|npm\s*v?11\.11\.0)\b/i, message: 'contains an internal verification runtime pin' },
  { code: 'credential-assignment', pattern: /\b(?:api[_ -]?key|access[_ -]?token|client[_ -]?secret|authorization|password|secret|cookie|session)\s*[:=]\s*[^\s`'"}]+/i, message: 'contains a credential-shaped assignment' },
  { code: 'credential-token', pattern: /\b(?:Bearer\s+[A-Za-z0-9._-]{8,}|(?:sk|ghp|github_pat|xox[baprs])-[A-Za-z0-9_-]{8,}|AKIA[A-Z0-9]{12,})\b/i, message: 'contains a credential-shaped token' },
  { code: 'private-key', pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----|\b(?:private\s+key|secret\s+key)\b/i, message: 'contains private-key material or instructions' },
]

// A small high-signal vocabulary catches common accidental translations while
// allowing technical identifiers and code samples. Non-ASCII letters are also
// rejected in prose below, so accented translations are covered independently.
const nonEnglishMarkers = [
  /\b(?:instal(?:ar|ación)|seguridad|documentación|contribuir|licencia|ejemplo|factura(?:ción|s)?|introducción|cómo|también|siguiente|para)\b/i,
  /\b(?:sécurité|contribuer|exemple|facturation|suivant)\b/i,
  /\b(?:sicherheit|beitragen|lizenz|beispiel|rechnung|einführung|weiter)\b/i,
  /\b(?:installazione|sicurezza|documentazione|contribuire|licenza|esempio|fattura|introduzione)\b/i,
  /\b(?:instalação|segurança|documentação|contribuir|licença|exemplo|fatura|introdução)\b/i,
]

function displayPath(filePath) {
  const relativePath = relative(root, filePath)
  return relativePath && !relativePath.startsWith('..') ? relativePath : filePath
}

function issue(filePath, line, code, message) {
  return { filePath, line, code, message }
}

function withoutInlineCode(line) {
  return line
    .replace(/`[^`]*`/g, ' ')
    // Link destinations are not visible prose, but labels and image alt text
    // are. Keep those labels so the English-only check covers what readers
    // actually see.
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
}

function visibleMarkdownSource(text) {
  const visibleLines = []
  let inFence = false
  let fenceMarker = ''
  let inComment = false

  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    let visible = ''
    let cursor = 0
    while (cursor < line.length) {
      if (inComment) {
        const end = line.indexOf('-->', cursor)
        if (end === -1) {
          cursor = line.length
          continue
        }
        inComment = false
        cursor = end + 3
        continue
      }

      const commentStart = line.indexOf('<!--', cursor)
      const nextComment = commentStart === -1 ? line.length : commentStart
      visible += line.slice(cursor, nextComment)
      if (commentStart === -1) break

      const commentEnd = line.indexOf('-->', commentStart + 4)
      if (commentEnd === -1) {
        inComment = true
        break
      }
      cursor = commentEnd + 3
    }

    const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(visible)
    if (fence) {
      if (!inFence) {
        inFence = true
        fenceMarker = fence[1][0]
      } else if (fence[1][0] === fenceMarker) {
        inFence = false
      }
      visibleLines.push('')
      continue
    }
    visibleLines.push(inFence ? '' : visible)
  }

  return visibleLines.join('\n')
}

function collectVisibleMarkdownLinkDestinations(text) {
  const source = visibleMarkdownSource(text).replace(/`[^`]*`/g, ' ')
  const destinations = []

  // Parse inline links instead of searching the whole README. This handles
  // nested image labels such as `[![badge](image)](target)` and destinations
  // containing balanced parentheses without treating raw URLs as links.
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== '[') continue
    let labelDepth = 1
    let cursor = index + 1
    while (cursor < source.length && labelDepth > 0) {
      if (source[cursor] === '\\') {
        cursor += 2
        continue
      }
      if (source[cursor] === '[') labelDepth += 1
      if (source[cursor] === ']') labelDepth -= 1
      cursor += 1
    }
    if (labelDepth !== 0) continue
    while (/\s/.test(source[cursor] ?? '')) cursor += 1
    if (source[cursor] !== '(') continue

    cursor += 1
    while (/\s/.test(source[cursor] ?? '')) cursor += 1
    if (source[cursor] === '<') {
      const end = source.indexOf('>', cursor + 1)
      if (end !== -1) {
        destinations.push(source.slice(cursor + 1, end))
        index = end
      }
      continue
    }

    const destinationStart = cursor
    let nestedParentheses = 0
    while (cursor < source.length) {
      if (source[cursor] === '\\') {
        cursor += 2
        continue
      }
      if (source[cursor] === '(') nestedParentheses += 1
      if (source[cursor] === ')') {
        if (nestedParentheses === 0) break
        nestedParentheses -= 1
      }
      if (/\s/.test(source[cursor]) && nestedParentheses === 0) break
      cursor += 1
    }
    if (cursor > destinationStart) destinations.push(source.slice(destinationStart, cursor))
    index = cursor
  }

  // Reference-style links are visible where they are used; their definitions
  // are only destinations and must not count unless referenced by a label.
  const definitions = new Map()
  for (const match of source.matchAll(/^\s{0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/gm)) {
    definitions.set(match[1].trim().toLowerCase(), match[2] ?? match[3])
  }
  for (const match of source.matchAll(/!?\[([^\]]+)\]\[([^\]]*)\]/g)) {
    const reference = (match[2] || match[1]).trim().toLowerCase()
    const destination = definitions.get(reference)
    if (destination) destinations.push(destination)
  }
  return destinations
}

function collectHeadings(lines, filePath, errors) {
  const headings = []
  let inFence = false
  let fenceMarker = ''

  lines.forEach((line, index) => {
    const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (!inFence) {
        inFence = true
        fenceMarker = fence[1][0]
      } else if (fence[1][0] === fenceMarker) {
        inFence = false
      }
      return
    }
    if (inFence) return

    const match = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) return

    const level = match[1].length
    const text = match[2].trim()
    headings.push({ level, text, line: index + 1 })
    if (level > 2) {
      errors.push(issue(filePath, index + 1, 'heading-depth', `heading "${text}" is level ${level}; public README headings may be level 1 or 2`))
    }
  })

  if (headings.length === 0) {
    errors.push(issue(filePath, 1, 'heading-missing', 'add a level-1 title'))
    return headings
  }
  if (headings[0].level !== 1) {
    errors.push(issue(filePath, headings[0].line, 'heading-first', 'the first heading must be level 1'))
  }
  if (headings.filter(heading => heading.level === 1).length !== 1) {
    errors.push(issue(filePath, 1, 'heading-count', 'use exactly one level-1 title'))
  }

  const seen = new Map()
  for (const heading of headings) {
    const normalized = heading.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    const previous = seen.get(normalized)
    if (previous) {
      errors.push(issue(filePath, heading.line, 'heading-duplicate', `heading duplicates line ${previous}: "${heading.text}"`))
    } else {
      seen.set(normalized, heading.line)
    }
  }
  return headings
}

function validateDocument(text, filePath, profile) {
  const errors = []
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  if (lines.at(-1) === '') lines.pop()

  if (lines.length > profile.maxLines) {
    errors.push(issue(filePath, profile.maxLines + 1, 'line-limit', `${profile.name} is ${lines.length} lines; maximum is ${profile.maxLines}`))
  }

  let inFence = false
  let fenceMarker = ''
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1
    const fence = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (!inFence) {
        inFence = true
        fenceMarker = fence[1][0]
      } else if (fence[1][0] === fenceMarker) {
        inFence = false
      }
    }
    if (!inFence && line.length > profile.maxLineLength) {
      errors.push(issue(filePath, lineNumber, 'line-length', `line is ${line.length} characters; maximum is ${profile.maxLineLength}`))
    }

    const visible = withoutInlineCode(line)
    if (inFence) continue
    if (/[^\x00-\x7F]/.test(visible) && /\p{L}/u.test(visible)) {
      errors.push(issue(filePath, lineNumber, 'non-english-letter', 'prose contains a non-ASCII letter; public README prose must be English'))
    }
    for (const marker of nonEnglishMarkers) {
      if (marker.test(visible)) {
        errors.push(issue(filePath, lineNumber, 'non-english-marker', 'prose contains a likely non-English phrase'))
        break
      }
    }
  }

  const headings = collectHeadings(lines, filePath, errors)
  const title = headings.find(heading => heading.level === 1)
  if (title && !profile.title.test(title.text)) {
    errors.push(issue(filePath, title.line, 'title', `title must identify ${profile.name}`))
  }
  for (const pattern of profile.headings) {
    if (!headings.some(heading => pattern.test(heading.text))) {
      errors.push(issue(filePath, 1, 'required-section', `missing a required section matching ${pattern.source}`))
    }
  }

  const visibleLinkDestinations = collectVisibleMarkdownLinkDestinations(text)
  for (const link of profile.links) {
    if (!visibleLinkDestinations.some(destination => link.pattern.test(destination))) {
      errors.push(issue(filePath, 1, 'required-link', `missing ${link.name} link`))
    }
  }

  for (const forbidden of forbiddenPatterns) {
    const match = forbidden.pattern.exec(text)
    if (match) {
      const line = text.slice(0, match.index).split('\n').length
      errors.push(issue(filePath, line, forbidden.code, forbidden.message))
    }
  }
  return errors
}

function parseArguments(argumentsList) {
  const selectedProfiles = []
  const files = []
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index]
    if (argument === '--help' || argument === '-h') return { help: true }
    if (argument === '--profile') {
      const name = argumentsList[index + 1]
      if (!name || !profiles[name]) throw new Error(`unknown profile "${name ?? ''}" (choose ${Object.keys(profiles).join(', ')})`)
      selectedProfiles.push(name)
      index += 1
      continue
    }
    if (argument === '--file') {
      const file = argumentsList[index + 1]
      if (!file) throw new Error('--file requires a Markdown path')
      files.push(resolve(file))
      index += 1
      continue
    }
    throw new Error(`unknown argument "${argument}" (use --help for usage)`)
  }
  if (files.length && selectedProfiles.length !== 1) {
    throw new Error('--file requires exactly one --profile')
  }
  const names = selectedProfiles.length ? selectedProfiles : Object.keys(profiles)
  return { profiles: names.map(name => profiles[name]), files }
}

function printHelp() {
  console.log('Usage: node scripts/validate-public-readmes.mjs [--profile main|example] [--file path]')
  console.log('With no arguments, validates README.md and examples/multi-format/README.md.')
}

function run() {
  const selection = parseArguments(process.argv.slice(2))
  if (selection.help) {
    printHelp()
    return 0
  }

  const errors = []
  for (const [index, profile] of selection.profiles.entries()) {
    const filePath = selection.files[index] ?? resolve(root, profile.path)
    let text
    try {
      text = readFileSync(filePath, 'utf8')
    } catch (error) {
      errors.push(issue(filePath, 1, 'read-error', `cannot read file: ${error.message}`))
      continue
    }
    errors.push(...validateDocument(text, filePath, profile))
  }

  if (errors.length) {
    for (const finding of errors) {
      console.error(`${displayPath(finding.filePath)}:${finding.line} [${finding.code}] ${finding.message}`)
    }
    console.error(`Public README validation failed with ${errors.length} finding${errors.length === 1 ? '' : 's'}.`)
    return 1
  }
  console.log(`Public README validation passed for ${selection.profiles.map(profile => profile.path).join(', ')}.`)
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = run()
  } catch (error) {
    console.error(`Public README validation could not run: ${error.message}`)
    process.exitCode = 2
  }
}

export { profiles, validateDocument }
