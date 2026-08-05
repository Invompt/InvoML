import { hydrateCalculatedDocument, hydrateComputedItems } from './calculator.js'
import type { InvoMLDocument } from './types.js'

/**
 * Clone a document and refresh the computed fields needed by renderers/serializers.
 * When totals are already part of the document we recompute them as well; otherwise
 * we only refresh per-line computed fields to preserve the caller's shape.
 */
export function prepareDocumentForOutput(doc: InvoMLDocument): InvoMLDocument {
  const prepared = structuredClone(doc)
  return doc.totals
    ? hydrateCalculatedDocument(prepared)
    : hydrateComputedItems(prepared)
}
