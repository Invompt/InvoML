// Subpath entry point for `invoml/validator` (declared in package.json "exports").
// Re-exports JSON Schema validation only — NOT domain validation (which lives in validation.ts).
// This barrel is intentional: it gives consumers a lightweight import that avoids pulling in
// the full calculator/renderer dependency graph.
export { validateSchema, setSchema } from './schema.js'
export type { ValidationResult } from './schema.js'
