import { prepareDocumentForOutput } from './document-preparation.js'
import { resolvePresentation, type PresentationResult } from './presentation.js'
import type { InvoMLDocument } from './types.js'

/** Options for `toJSON`. */
export interface JSONOptions {
  /** Produce minified JSON instead of the default two-space indentation. */
  compact?: boolean
}

/** Serialize authored data plus refreshed runtime-derived fields without mutating input. */
export function toJSON(doc: InvoMLDocument, options: JSONOptions = {}): string {
  return JSON.stringify(
    prepareDocumentForOutput(doc),
    null,
    options.compact ? undefined : 2,
  )
}

/** Resolve and render Markdown with deterministic presentation diagnostics. */
export function renderMarkdown(doc: InvoMLDocument): PresentationResult {
  return resolvePresentation(doc, 'markdown')
}

/** Render Markdown and return output only. */
export function toMarkdown(doc: InvoMLDocument): string {
  return renderMarkdown(doc).output
}
