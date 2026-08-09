import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { calculate } from '../src/calculator.js'
import type { InvoMLDocument } from '../src/types.js'
import { validate } from '../src/validation.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const vectorsDir = join(__dirname, '..', 'test-vectors')

const vectorFiles = readdirSync(vectorsDir)
  .filter(f => f.match(/^\d{2}-.*\.json$/) && !f.includes('.expected.'))
  .sort()

describe('InvoML Test Vectors', () => {
  it('vector 13 is schema-valid domain-valid and totals -90 for a credit note', () => {
    const input = JSON.parse(
      readFileSync(join(vectorsDir, '13-credit-note.json'), 'utf8'),
    ) as InvoMLDocument
    const validation = validate(input)
    expect(validation.valid).toBe(true)
    expect(validation.issues.filter(issue => issue.level === 'error')).toHaveLength(0)

    const result = calculate(input)
    expect(result.subtotal).toBe(-75)
    expect(result.taxTotal).toBe(-15)
    expect(result.total).toBe(-90)
    expect(result.amountDue).toBe(-90)
  })

  for (const file of vectorFiles) {
    const name = file.replace('.json', '')
    const expectedFile = file.replace('.json', '.expected.json')

    it(`Vector: ${name}`, () => {
      const input = JSON.parse(readFileSync(join(vectorsDir, file), 'utf8')) as InvoMLDocument
      const expected = JSON.parse(readFileSync(join(vectorsDir, expectedFile), 'utf8'))

      if (expected.error) {
        expect(() => calculate(input)).toThrow()
        return
      }

      const result = calculate(input)

      for (const [key, value] of Object.entries(expected)) {
        if (key === 'taxDetails') {
          for (const ed of value as any[]) {
            const actual = result.taxDetails?.find(t => t.category === ed.category)
            expect(actual, `taxDetail ${ed.category}`).toBeDefined()
            if (ed.base !== undefined) expect(actual!.base).toBe(ed.base)
            if (ed.amount !== undefined) expect(actual!.amount).toBe(ed.amount)
          }
        } else {
          expect((result as any)[key], key).toBe(value)
        }
      }
    })
  }
})
