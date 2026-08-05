import type { InvoMLDocument } from './types.js'
import { resolvePresentation, type PresentationResult } from './presentation.js'
import type { RenderOptions } from './render-options.js'

export type { RenderOptions } from './render-options.js'

/** Resolve and render HTML with deterministic presentation diagnostics. */
export function renderHTML(doc: InvoMLDocument, options?: RenderOptions): PresentationResult {
  return resolvePresentation(doc, 'html', options)
}

/** Render HTML and return output only. */
export function toHTML(doc: InvoMLDocument, options?: RenderOptions): string {
  return renderHTML(doc, options).output
}
