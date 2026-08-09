# Changelog

All notable changes to this project will be documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0-alpha.23] - 2026-08-09

### Changed
- **Signed credit values** — align domain validation with the specification by allowing signed quantities and unit prices while continuing to reject zero quantities and non-finite values
- **LLM validation boundary** — enforce `parse() → validate() → calculate()` in typechecked provider examples and documentation
- **Release controls** — pin source CI to Node.js 22.22.0, enforce compare-based default-branch ancestry in trusted publishing, and bind the candidate to `1.0.0-alpha.23` on `next`

## [1.0.0-alpha.22] - 2026-08-09

### Changed
- **Release candidate preparation** — package metadata, README guidance, and trusted-publish contracts are aligned for the next prerelease

## [1.0.0-alpha.21] - 2026-08-05

### Changed
- **Release candidate hardening** — package contents are an exact reviewed allowlist, repository-owned privacy checks cover source, pack reports, and unpacked trees, and the release workflow uses an isolated npm OIDC publish job for the `next` tag

## [1.0.0-alpha.20] - 2026-08-04

### Added
- **Paged-media footer intent** — `style.pageFooter` supports visibility and `{page}` / `{pages}` formatting, resolves localized defaults through `resolvePageFooter()`, and is exposed in HTML output metadata

### Fixed
- **Lock resolution** — updates the pinned `fast-uri` registry resolution to 3.1.5

## [1.0.0-alpha.19] - 2026-07-30

### Added
- **Unified presentation resolver** — `resolvePresentation(doc, target)`, `renderHTML()`, and `renderMarkdown()` return output plus deterministic diagnostics for templates, order, visibility, missing data, block tokens, and target fallbacks; `toHTML()` and `toMarkdown()` remain output-only helpers
- **Typed presentation tokens** — finite spans, logical alignment, page boundaries, and keep-together controls with deterministic HTML row grouping and explicit Markdown fallback diagnostics
- **Computed payment advice** — opt-in invoice-only remittance block with recalculated amount due, due date, derived customer, blank amount enclosed, semantic HTML metadata, and read-only computed values
- **Localized payment advice** — titles and field labels follow every supported invoice locale with English fallback
- **Presentation subpath** — `invoml/presentation`

### Changed
- **Forward-only style contract** — `style.template` is exactly `standard | minimal | professional`; `style.blocks` accepts only typed tokens; raw document-authored CSS and `style.properties` are schema-invalid
- **Safe rendering boundary** — public renderers always normalize untrusted runtime documents and emit rejection diagnostics; pre-resolved internal rendering state is no longer publicly injectable
- **Deterministic page rows** — page boundaries force grid-row boundaries, and the default consecutive `from` / `to` pair retains its half-width layout
- **Trusted CSS boundary** — only runtime `RenderOptions.theme` and `RenderOptions.customCss` accept styling values

### Removed
- **Legacy CSS authoring helpers** — removed `src/html-style.ts` and all raw per-document CSS behavior

## [1.0.0-alpha.18] - 2026-07-29

### Added
- **Structured postal addresses** — structured parties now use `address.lines: string[]`, preserving ordered lines, intentional blanks, Unicode, and right-to-left text without newline-sensitive address strings
- **Locale-aware date presentation** — `style.dateFormat` accepts the finite `iso`, `numeric`, `medium`, and `long` presets; issue, due, and expiry dates render with the document locale and UTC while JSON retains canonical ISO values
- **Date formatting API** — `formatDate()` and `DATE_FORMAT_PRESETS` are exported from the package root

### Changed
- **Party representation is exclusive** — `from` and `to` must contain either non-empty free-form `content` or one or more structured fields, never both; empty parties and legacy string addresses are rejected
- **Editable dates stay canonical** — editable HTML keeps ISO date text so DOM extraction cannot persist localized display strings into canonical date fields

## [1.0.0-alpha.15] - 2026-07-14

### Added
- **Theme presets** — `THEME_PRESETS` (`standard`, `slate`, `ember`, `forest`, `violet`, `mono`, `editorial`) and `resolveTheme()` in the new `invoml/themes` subpath; themes set container CSS custom properties and density, and serializable `InvoMLTheme` objects are accepted inline
- **`RenderOptions.theme` / `RenderOptions.customCss`** — `toHTML()` layers theme properties before the document's `style.properties`; `customCss` is appended as the final (winning) style layer
- **CLI render options** — `--theme` and `--custom-css` flags apply to `html`

### Fixed
- **Container property layers no longer lose to template CSS** — theme and document `style.properties` rules are now emitted with a doubled-class selector (`.invoml-container.invoml-container`, specificity 0,2,0) matching `TEMPLATE_CSS`'s attribute selectors, so cascade order decides: base < template < theme < document properties < customCss. Previously a document with `style.template` set would silently ignore `style.properties` overrides of the same custom properties

## [1.0.0-alpha.14] - 2026-04-16

### Fixed
- **Schema: `style.hidden` field now declared in `invoml-v1.0.schema.json`** — the `hidden` array is part of `InvoMLStyle` in `src/types.ts` and is consumed by `resolveHidden`, the serializer, and renderers, but the JSON schema's `style` block omitted it under `additionalProperties: false`. Valid documents using `style.hidden` would fail schema validation. The field is now declared as an array of unique strings with documented prefixes (`column:{name}`, `block:{name}`, `meta:{field}`, `section:{key}`).

## [1.0.0-alpha.4] - 2026-03-31

### Fixed
- **Arithmetic: native float before Decimal conversion** — all intermediate multiplications and divisions in `calculator.ts` and `discounts.ts` now use `Decimal` operations throughout; native float is no longer used before `roundHalfUp`, eliminating wrong results for ~1.1% of quantity/price combinations
- **Arithmetic: inclusive mode ignores withholding/exempt categories** — the inclusive tax branch now separates `regularCats` and `withholdingCats` (matching the exclusive branch); exempt categories are treated as zero tax in inclusive mode
- **Security: CSS injection via `style.properties`** — property names and values are now sanitized before insertion into `<style>` blocks; characters that break out of CSS declaration context (`}`, `{`, `;`, `@`, `url(`, `\n`, `\r`) are rejected
- **Security: per-block CSS injection via `style.blocks`** — `display: none`, `visibility: hidden`, and off-screen positioning are rejected on critical blocks (`totals`, `items`) to prevent visual deception of financial amounts
- **Security: unescaped `documentType` in `renderHeader`** — the derived type label is now passed through `esc()` before insertion into HTML output
- **Security: missing single-quote escaping in `escapeHtml`** — `'` is now escaped to `&#39;` for defense in depth

### Changed
- **Spec: SPEC.md §5.5 inclusive+withholding formula corrected** — `withholdingTotal` now documents the use of the already-computed `catTax` value (matching the alpha.3 implementation fix) instead of a re-derivation
- **Docs: LLM-INTEGRATION.md calling convention fixed** — all three provider examples (OpenAI, Anthropic, Gemini) and the validation pipeline diagram now use the correct one-argument form: `toMarkdown({ ...parsed.document, totals })` and `toJSON({ ...parsed.document, totals })`; the two-argument form was a TypeScript error
- **Docs: LLM-INTEGRATION.md Anthropic model updated** — example uses `claude-sonnet-4-6`
- **Docs: RENDERING.md §1.2 decimal places rule corrected** — "2 decimal places" changed to "the currency's ISO 4217 decimal places" to correctly cover JPY (0), KWD (3), and other non-2-decimal currencies
- **Docs: RENDERING.md §7.4 phantom `style.colors` field removed** — replaced with accurate references to `style.properties` color values
- **Docs: CONTRIBUTING.md** — added test vector authoring section documenting the `NN-name.json` / `NN-name.expected.json` format and the `{ "error": true }` convention for error vectors

## [1.0.0-alpha.3] - 2026-03-31

### Added
- `html` CLI command: `invoml html invoice.json > invoice.html`
- `src/markdown.ts` — extracted markdown/HTML processor with XSS prevention
- `src/html-css.ts` — extracted CSS constants for HTML renderer templates
- `src/format.ts` — shared number formatter (DRY extraction)
- `allocateProportionally()` — shared proportional discount allocation with tie-breaking
- Test coverage for parser, schema validation, markdown processing, number formatting, XSS prevention (372 total tests, up from 315)
- `tsconfig.build.json` — dedicated build config that excludes test files from dist

### Fixed
- **Security: XSS in HTML renderer** — `processInline` now escapes HTML entities before applying Markdown transformations; link hrefs are validated to allow only `http:`, `https:`, and `mailto:` schemes
- **Arithmetic: inclusive+withholding rounding inconsistency** — withholding total now uses the already-computed tax amount instead of re-deriving it, eliminating one-cent rounding disagreements
- **Library hygiene: global Decimal.js mutation** — replaced `Decimal.set()` with `Decimal.clone()` to avoid silently changing global precision/rounding for consumers who also use decimal.js
- **Schema path resolution** — schema file now resolves correctly when running from both source (tests) and dist (installed package)

### Changed
- Improved schema field descriptions for `from.content`, `to.content`, `items[].discount`, `items[].taxCategory`, `style.order`, and `style.blocks` with concrete examples and explicit null/omit guidance
- Updated LLM system prompt templates (OpenAI, Anthropic, Gemini) with critical output rules for null handling, block names, and content field usage
- Added "Common Mistakes from Real AI Testing" section to LLM-INTEGRATION.md (#10-#13)
- **SRP refactor: `html-renderer.ts`** split from 706 → 326 lines by extracting CSS constants and markdown processing into dedicated modules
- **DRY refactor: `calculator.ts`** deduplicated proportional discount allocation pattern (was copy-pasted between inclusive and standard tax paths)
- `String.replace('_', ' ')` → `String.replaceAll('_', ' ')` in serializer and HTML renderer for correctness with multi-underscore document types
- Removed dead `toDecimal()` export from rounding module
- Build script now uses `tsconfig.build.json` (test artifacts no longer compiled to dist)

## [1.0.0-alpha.2] - 2026-03-30

### Added
- Style system: unified `style` object replacing the old `layout` field
- Named templates: `standard`, `minimal`
- Block ordering via `style.order` with `section:{key}` references
- Per-block CSS-compatible styling via `style.blocks`
- Document-level properties via `style.properties`
- `validateStyle()`, `resolveOrder()`, `resolveStyle()` API functions
- `toHTML()` renderer producing self-contained HTML documents
- Rendering companion guide (`docs/RENDERING.md`)
- Style system design specification (`docs/specs/2026-03-30-style-system-design.md`)

### Removed
- `layout` field and all layout types (`InvoMLLayoutEntry`, `InvoMLLayoutBlock`, `InvoMLLayoutRow`)
- `validateLayout()` and `resolveLayout()` functions (replaced by style equivalents)

### Changed
- SPEC.md Section 6 rewritten for the style model
- All examples migrated from `layout` to `style`
- LLM-INTEGRATION.md updated with style and ordering guidance

## [1.0.0-alpha.1] - 2026-03-30

### Added
- InvoML v1.0 specification and JSON Schema
- TypeScript reference implementation: parser, calculator, validator, serializer
- 18 canonical test vectors with expected outputs
- 17 real-world invoice examples across 15+ countries
- CLI tool for validation, calculation, and serialization
- Decimal.js-based arbitrary-precision arithmetic

### Notes
- This is an alpha release. The API may change before stable 1.0.0.
