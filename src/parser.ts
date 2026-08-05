import { validateSchema } from './schema.js'
import type { InvoMLDocument } from './types.js'

/**
 * Discriminated union returned by `parse`.
 * On success, `document` is the typed `InvoMLDocument`.
 * On failure, `errors` lists all JSON parse or schema validation problems.
 */
export type ParseResult =
  | {
      success: true
      document: InvoMLDocument
    }
  | {
      success: false
      errors: string[]
    }

/** Parse a JSON string into a typed InvoML document. Validates against the JSON Schema before returning. */
export function parse(input: string): ParseResult {
  let doc: unknown
  try {
    doc = JSON.parse(input)
  } catch (e) {
    return { success: false, errors: [`Invalid JSON: ${(e as Error).message}`] }
  }
  const validation = validateSchema(doc)
  if (!validation.valid) {
    return { success: false, errors: validation.errors }
  }
  return { success: true, document: doc as InvoMLDocument }
}
