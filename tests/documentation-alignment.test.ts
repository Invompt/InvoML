import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

const llmGuide = read('docs/LLM-INTEGRATION.md')
const readme = read('README.md')
const releaseGuide = read('docs/RELEASING.md')
const securityPolicy = read('SECURITY.md')
const spec = read('SPEC.md')
const whyInvoml = read('docs/WHY-INVOML.md')

const extractProviderExample = (sectionHeading: string): string => {
  const sectionStart = llmGuide.indexOf(`## ${sectionHeading}`)
  expect(sectionStart).toBeGreaterThanOrEqual(0)

  const remainingGuide = llmGuide.slice(sectionStart)
  const nextSectionStart = remainingGuide.indexOf('\n## ', 1)
  const section =
    nextSectionStart === -1
      ? remainingGuide
      : remainingGuide.slice(0, nextSectionStart)
  const example = section.match(/### Complete example\s+```typescript\n([\s\S]*?)\n```/)

  expect(example).not.toBeNull()
  return example?.[1] ?? ''
}

describe('active documentation alignment', () => {
  it('uses the prerelease candidate channel in every provider install command', () => {
    const installCommands = llmGuide.match(/^npm install .+invoml.*$/gm) ?? []

    expect(installCommands).toHaveLength(3)
    for (const command of installCommands) {
      expect(command).toContain('invoml@next')
    }
  })

  it('keeps provider guidance current and preserves local validation', () => {
    expect(llmGuide).toContain('The pinned `openai@7.4.0` example requires Node.js 22 or newer.')
    expect(llmGuide).toContain('Run this typechecked provider example on the repository runtime, Node.js 22.22.0.')
    expect(llmGuide).toContain('The pinned `@google/genai@2.16.0` example requires Node.js 20 or newer.')
    expect(llmGuide).not.toMatch(
      /gpt-4o-2024-08-06|claude-haiku-3\.5|gemini-2\.0-flash/,
    )
    expect(llmGuide).toContain('client.responses.create')
    expect(llmGuide).toContain("format: { type: 'json_object' }")
    expect(llmGuide).toContain(
      'JSON mode guarantees syntactically valid JSON, not a valid InvoML document.',
    )
    expect(llmGuide).toContain("if (!parsed.success) {\n        throw new Error(`Parse failed:")
    expect(llmGuide).toContain(
      'forces a tool call; it does not guarantee that the tool input conforms',
    )
    expect(llmGuide).toContain('ai.interactions.create')
    expect(llmGuide).toContain("mime_type: 'application/json'")
    expect(llmGuide).toContain('| Authoritative validation | `parse() → validate()` | `parse() → validate()` | `parse() → validate()` |')
    expect(llmGuide).toContain('`"credit_note"`, `"receipt"`, or `"estimate"`')
    expect(llmGuide).toContain(
      'Without `style.order`, custom sections render after totals in alphabetical order.',
    )
    expect(llmGuide).toContain('raises an `UNKNOWN_CATEGORY` calculation error')
  })

  it.each([
    ['OpenAI Responses API', 'examples/llm-providers/openai.ts'],
    ['Anthropic Tool Use', 'examples/llm-providers/anthropic.ts'],
    ['Google Gemini Structured Output', 'examples/llm-providers/gemini.ts'],
  ])('keeps the %s example identical to its typechecked fixture', (heading, path) => {
    expect(extractProviderExample(heading)).toBe(read(path).trimEnd())
  })

  it('requires live registry verification instead of claiming publication from source', () => {
    expect(releaseGuide).toContain(
      '`invoml@1.0.0-alpha.23`, prepared for the `next` dist-tag.',
    )
    expect(releaseGuide).toContain(
      'this source document never proves publication',
    )
    expect(releaseGuide).not.toMatch(/is published on npm under the `next` dist-tag/i)
    expect(securityPolicy).toContain('current `next` prerelease line')
    expect(securityPolicy).toContain('npm view invoml dist-tags --json')
  })

  it('keeps packed README links usable outside the repository checkout', () => {
    expect(readme).toContain(
      '[security policy](https://github.com/Invompt/InvoML/blob/main/SECURITY.md)',
    )
    expect(readme).toContain(
      '[contributing guide](https://github.com/Invompt/InvoML/blob/main/CONTRIBUTING.md)',
    )
  })
})

describe('specification vector inventory', () => {
  const vectorDirectory = new URL('../test-vectors/', import.meta.url)
  const vectorInputs = readdirSync(vectorDirectory)
    .filter(name => /^\d{2}-.+\.json$/.test(name))
    .filter(name => !name.endsWith('.expected.json'))
    .sort()
  const errorVectors = vectorInputs.filter(name => {
    const expectedName = name.replace(/\.json$/, '.expected.json')
    const expected = JSON.parse(
      readFileSync(new URL(expectedName, vectorDirectory), 'utf8'),
    ) as { error?: boolean }
    return expected.error === true
  })
  const documentedVectors = [...spec.matchAll(/^\| VEC-(\d{2}) \|/gm)].map(
    match => match[1],
  )

  it('documents every canonical vector and the success/error split', () => {
    expect(vectorInputs).toHaveLength(21)
    expect(errorVectors).toHaveLength(2)
    expect(documentedVectors).toEqual(
      vectorInputs.map(name => name.slice(0, 2)),
    )
    expect(spec).toContain('The following 21 test vectors are normative.')
    expect(spec).toContain('all 19 successful normative test vectors')
  })

  it('keeps section numbering and overview claims aligned', () => {
    const sectionTwoHeadings = spec.match(/^### 2\.\d+ .+$/gm) ?? []
    expect(new Set(sectionTwoHeadings).size).toBe(sectionTwoHeadings.length)
    expect(spec).toContain('### 2.10 Totals')
    expect(whyInvoml).toContain('21 canonical test vectors')
    expect(whyInvoml).not.toMatch(/15\+ countries|18 canonical test vectors|byte-identical totals/)
  })
})
