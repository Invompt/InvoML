import type { BaseValidationResult } from './types.js'
import Ajv from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

// These fs/path/url imports are Node-only. In browser/edge runtimes they will be
// unavailable — callers must invoke setSchema() before any validation in those envs.
// Tree-shakers can eliminate this block entirely when setSchema() is always called.
let _readFileSync: ((path: string, enc: string) => string) | null = null
let _schemaPath: string | null = null
try {
  const { readFileSync, existsSync } = await import('node:fs')
  const { dirname, join } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const __dirname = dirname(fileURLToPath(import.meta.url))
  // dist/src/ needs ../../, src/ needs ../ — try dist path first, fall back to source
  const distPath = join(__dirname, '..', '..', 'invoml-v1.0.schema.json')
  const srcPath = join(__dirname, '..', 'invoml-v1.0.schema.json')
  if (existsSync(distPath)) {
    _schemaPath = distPath
  } else if (existsSync(srcPath)) {
    _schemaPath = srcPath
  } else {
    throw new Error(
      `InvoML schema file not found at "${distPath}" or "${srcPath}". ` +
      `Ensure the package is built correctly, or call setSchema() to inject the schema directly.`,
    )
  }
  _readFileSync = (path: string, enc: string) => readFileSync(path, enc as BufferEncoding) as string
} catch (e) {
  // Browser/edge environment, or schema file missing — setSchema() must be called before use.
  // Re-throw only when it is a schema-not-found error (not a simple module-not-found).
  if (e instanceof Error && e.message.startsWith('InvoML schema file not found')) throw e
}

let ajvInstance: Ajv | null = null
let validateFn: ReturnType<Ajv['compile']> | null = null
let injectedSchema: object | null = null

/** Inject the JSON Schema directly, bypassing filesystem loading. Required for browser and edge runtimes. */
export function setSchema(schema: object): void {
  injectedSchema = schema
  validateFn = null
}

function getValidator() {
  if (!validateFn) {
    let schema: object
    if (injectedSchema) {
      schema = injectedSchema
    } else if (_readFileSync && _schemaPath) {
      schema = JSON.parse(_readFileSync(_schemaPath, 'utf8'))
    } else {
      throw new Error(
        'InvoML schema is not available. Call setSchema() before using validateSchema() in browser or edge environments.',
      )
    }
    ajvInstance = new Ajv({ allErrors: true, strict: false, validateFormats: true })
    addFormats(ajvInstance)
    validateFn = ajvInstance.compile(schema)
  }
  return validateFn
}

/** Result of a JSON Schema validation pass — a validity flag plus human-readable AJV error messages. */
export interface ValidationResult extends BaseValidationResult {
  errors: string[]
}

/** Validate an arbitrary value against the InvoML v1.0 JSON Schema. Useful for pre-validating AI output before calling `parse`. */
export function validateSchema(doc: unknown): ValidationResult {
  const validate = getValidator()
  const valid = validate(doc) as boolean
  if (valid) return { valid: true, errors: [] }
  const errors = (validate.errors ?? []).map(e => {
    const path = e.instancePath || '/'
    return `${path}: ${e.message}`
  })
  return { valid: false, errors }
}
