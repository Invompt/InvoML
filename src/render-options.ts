import type { InvoMLTheme } from './themes.js'

/** Trusted runtime options for HTML rendering. None are document-authored InvoML. */
export interface RenderOptions {
  /** Return an embeddable style + container fragment without the outer HTML document. */
  fragment?: boolean
  /** Add editing metadata while keeping computed fields read-only. */
  editable?: boolean
  /** Trusted runtime theme preset or inline theme. */
  theme?: string | InvoMLTheme
  /** Trusted runtime CSS appended as the final cascade layer. */
  customCss?: string
}
