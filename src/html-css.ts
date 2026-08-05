/** Base CSS for all InvoML HTML output. Applied to every document regardless of template. */
export const BASE_CSS = `
/* InvoML base styles */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body { background: #f5f5f5; }

.invoml-container {
  --invoml-color-accent: #334155;
  --invoml-color-accent-soft: #f1f5f9;
  --invoml-color-text: #111827;
  --invoml-color-muted: #6b7280;
  --invoml-color-border: #d1d5db;
  --invoml-color-border-soft: #e5e7eb;
  --invoml-color-background: #ffffff;
  --invoml-font-heading: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --invoml-font-body: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --invoml-padding-y: 10mm;
  --invoml-padding-x: 12mm;
  --invoml-section-gap: 18px;
  --invoml-table-row-padding: 10px;
  --invoml-parties-gap: 28px;
  --invoml-payment-margin-top: 28px;
  --invoml-meta-gap: 18px;
  --invoml-totals-margin: 18px;
  --invoml-line-height: 1.5;
  --invoml-paragraph-spacing: 12px;

  width: 210mm;
  margin: 0 auto;
  padding: var(--invoml-padding-y) var(--invoml-padding-x);
  background: var(--invoml-color-background);
  color: var(--invoml-color-text);
  font-family: var(--invoml-font-body);
  font-size: 14px;
  line-height: var(--invoml-line-height);
  -webkit-font-smoothing: antialiased;
}

.invoml-container h1, .invoml-container h2, .invoml-container h3,
.invoml-container h4, .invoml-container h5, .invoml-container h6 {
  font-family: var(--invoml-font-heading);
  color: var(--invoml-color-text);
  line-height: 1.3;
  margin: 0;
}

.invoml-container a { color: var(--invoml-color-accent); text-decoration: none; }
.invoml-container a:hover { text-decoration: underline; }
.invoml-container table { border-collapse: collapse; border-spacing: 0; width: 100%; }
.invoml-container th, .invoml-container td { text-align: left; vertical-align: top; }
.invoml-container ul, .invoml-container ol { padding-left: 1.5em; }
.invoml-container p + p { margin-top: var(--invoml-paragraph-spacing); }

/* Finite document-authored presentation tokens */
.invoml-presentation-row {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: var(--invoml-parties-gap);
  align-items: start;
}
.invoml-presentation-row > * { min-width: 0; grid-column: span 12; }
.invoml-presentation-row > [data-invoml-span="half"] { grid-column: span 6; }
.invoml-presentation-row > [data-invoml-span="one-third"] { grid-column: span 4; }
.invoml-presentation-row > [data-invoml-span="two-thirds"] { grid-column: span 8; }
.invoml-presentation-row > [data-invoml-align="start"] { text-align: start; }
.invoml-presentation-row > [data-invoml-align="center"] { text-align: center; }
.invoml-presentation-row > [data-invoml-align="end"] { text-align: end; }
.invoml-presentation-row[data-invoml-row-break-before="page"] {
  break-before: page;
  page-break-before: always;
}
.invoml-presentation-row[data-invoml-row-break-after="page"] {
  break-after: page;
  page-break-after: always;
}
.invoml-presentation-row > [data-invoml-keep-together="true"] {
  break-inside: avoid;
  page-break-inside: avoid;
}
.invoml-container [data-invoml-type="markdown-block"] > h1,
.invoml-container [data-invoml-type="markdown-block"] > h2,
.invoml-container [data-invoml-type="markdown-block"] > h3 {
  font-weight: 600;
  break-after: avoid;
  page-break-after: avoid;
  margin: 12px 0 6px;
}
.invoml-container [data-invoml-type="markdown-block"] > h1 { font-size: 18px; }
.invoml-container [data-invoml-type="markdown-block"] > h2 { font-size: 16px; }
.invoml-container [data-invoml-type="markdown-block"] > h3 { font-size: 14px; }
.invoml-container [data-invoml-type="markdown-block"] > h1:first-child,
.invoml-container [data-invoml-type="markdown-block"] > h2:first-child,
.invoml-container [data-invoml-type="markdown-block"] > h3:first-child {
  margin-top: 0;
}

/* Density variants */
.invoml-density-compact {
  --invoml-padding-y: 5mm;
  --invoml-padding-x: 6mm;
  --invoml-section-gap: 6px;
  --invoml-table-row-padding: 3px;
  --invoml-parties-gap: 10px;
  --invoml-payment-margin-top: 10px;
  --invoml-meta-gap: 6px;
  --invoml-totals-margin: 6px;
  --invoml-line-height: 1.3;
  --invoml-paragraph-spacing: 4px;
}
.invoml-density-spacious {
  --invoml-padding-y: 20mm;
  --invoml-padding-x: 24mm;
  --invoml-section-gap: 36px;
  --invoml-table-row-padding: 16px;
  --invoml-parties-gap: 48px;
  --invoml-payment-margin-top: 48px;
  --invoml-meta-gap: 28px;
  --invoml-totals-margin: 32px;
  --invoml-line-height: 1.8;
  --invoml-paragraph-spacing: 20px;
}

/* Header block */
.invoml-header { margin-bottom: var(--invoml-section-gap); }
.invoml-header-title {
  font-size: 28px;
  font-weight: 300;
  letter-spacing: -0.5px;
  color: var(--invoml-color-text);
  font-family: var(--invoml-font-heading);
  margin-bottom: 6px;
}
.invoml-header-number {
  font-size: 13px;
  font-weight: 600;
  color: var(--invoml-color-accent);
  letter-spacing: 0.5px;
  margin-bottom: 14px;
  display: inline-block;
  background: var(--invoml-color-accent-soft);
  padding: 3px 10px;
  border-radius: 4px;
}
.invoml-header-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--invoml-meta-gap);
  font-size: 13px;
}
.invoml-header-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 90px; }
.invoml-header-meta-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--invoml-color-muted);
  font-weight: 500;
}
.invoml-header-meta-value { color: var(--invoml-color-text); font-weight: 500; font-size: 13px; }

/* Party blocks */
.invoml-parties {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--invoml-parties-gap);
  margin-bottom: var(--invoml-section-gap);
}

.invoml-party {
  font-size: 14px;
  line-height: var(--invoml-line-height);
  vertical-align: top;
}

/* Single party without a sibling — preserve spacing */
.invoml-party:not(.invoml-parties > *) {
  margin-bottom: var(--invoml-section-gap);
}
.invoml-party-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--invoml-color-muted);
  margin-bottom: 8px;
  font-weight: 500;
}
.invoml-party-name {
  font-weight: 600;
  color: var(--invoml-color-text);
  font-size: 15px;
  margin-bottom: 6px;
}
.invoml-party-details { color: var(--invoml-color-muted); font-size: 13px; line-height: var(--invoml-line-height); }
.invoml-party-details > div { margin: 2px 0; }

/* Items table */
.invoml-items {
  width: 100%;
  max-width: 100%;
  table-layout: fixed;
  margin: var(--invoml-totals-margin) 0;
  overflow-wrap: anywhere;
}
.invoml-items th {
  padding: var(--invoml-table-row-padding) 0;
  border-bottom: 1px solid var(--invoml-color-border);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--invoml-color-muted);
  font-weight: 500;
}
.invoml-items td {
  padding: var(--invoml-table-row-padding) 0;
  border-bottom: 1px solid var(--invoml-color-border-soft);
  font-size: 14px;
  color: var(--invoml-color-text);
}
.invoml-items .col-right { text-align: right; padding-right: 0; padding-left: 12px; }
.invoml-items th:not(.col-right), .invoml-items td:not(.col-right):not(:first-child) { padding-left: 8px; }

/* Totals */
.invoml-totals { display: flex; justify-content: flex-end; margin-top: var(--invoml-totals-margin); }
.invoml-totals-inner { width: 300px; }
.invoml-totals-row {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  font-size: 14px;
  color: var(--invoml-color-text);
}
.invoml-totals-row.is-grand {
  border-top: 2px solid var(--invoml-color-text);
  margin-top: 8px;
  padding-top: 10px;
  font-size: 15px;
  font-weight: 600;
}
.invoml-totals-row.is-amount-due {
  border-top: 1px solid var(--invoml-color-border);
  margin-top: 4px;
  padding-top: 8px;
  font-weight: 600;
}
.invoml-totals-label { color: var(--invoml-color-muted); }
.invoml-totals-label.is-bold { color: var(--invoml-color-text); font-weight: 600; }
.invoml-totals-amount { font-variant-numeric: tabular-nums; }

/* Payment block */
.invoml-payment {
  margin-top: var(--invoml-payment-margin-top);
  padding-top: 24px;
  border-top: 1px solid var(--invoml-color-border);
}
.invoml-payment-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--invoml-color-muted);
  margin-bottom: 12px;
  font-weight: 500;
}
.invoml-payment-details { font-size: 14px; line-height: var(--invoml-line-height); color: var(--invoml-color-muted); }
.invoml-payment-details strong { color: var(--invoml-color-text); font-weight: 600; }

/* Computed payment/remittance advice */
.invoml-payment-advice {
  margin: var(--invoml-section-gap) 0;
  padding: 16px;
  border: 1px solid var(--invoml-color-border);
}
.invoml-payment-advice-title {
  font-size: 16px;
  margin-bottom: 10px;
}
.invoml-payment-advice-content { margin-bottom: 12px; }
.invoml-payment-advice-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 20px;
}
.invoml-payment-advice-field { min-width: 0; }
.invoml-payment-advice-label {
  display: block;
  color: var(--invoml-color-muted);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
}
.invoml-payment-advice-value {
  display: block;
  min-height: 1.5em;
  border-bottom: 1px solid var(--invoml-color-border);
  font-variant-numeric: tabular-nums;
}

/* Notes block */
.invoml-notes {
  margin-top: var(--invoml-section-gap);
  padding-top: var(--invoml-section-gap);
  border-top: 1px solid var(--invoml-color-border);
  font-size: 13px;
  color: var(--invoml-color-muted);
}

/* Section block */
.invoml-section { margin: var(--invoml-section-gap) 0; }
.invoml-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--invoml-color-text);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.invoml-section-content { font-size: 14px; color: var(--invoml-color-text); line-height: var(--invoml-line-height); }

@media print {
  body { background: none; margin: 0; padding: 0; }
  .invoml-container { width: 100%; margin: 0; box-shadow: none; }
}
`

/** Per-template CSS overrides. Applied when style.template is set. */
export const TEMPLATE_CSS: Record<string, string> = {
  standard: `
/* Template: standard */
.invoml-container[data-invoml-template="standard"] {
  --invoml-color-accent: #334155;
  --invoml-color-accent-soft: #f1f5f9;
  --invoml-color-text: #111827;
  --invoml-color-muted: #6b7280;
  --invoml-color-border: #d1d5db;
  --invoml-color-border-soft: #e5e7eb;
}
`,
  minimal: `
/* Template: minimal */
.invoml-container[data-invoml-template="minimal"] {
  --invoml-color-accent: #555555;
  --invoml-color-accent-soft: #f3f4f6;
  --invoml-color-text: #222222;
  --invoml-color-muted: #888888;
  --invoml-color-border: #eeeeee;
  --invoml-color-border-soft: #f3f4f6;
  --invoml-padding-y: 20mm;
  --invoml-padding-x: 24mm;
  --invoml-section-gap: 36px;
  --invoml-table-row-padding: 16px;
  --invoml-parties-gap: 48px;
  --invoml-payment-margin-top: 48px;
  --invoml-meta-gap: 28px;
  --invoml-totals-margin: 32px;
  --invoml-line-height: 1.8;
  --invoml-paragraph-spacing: 20px;
}
.invoml-container[data-invoml-template="minimal"] .invoml-header-number {
  background: none;
  padding: 0;
  letter-spacing: 1px;
}
`,
  professional: `
/* Template: professional */
.invoml-container[data-invoml-template="professional"] {
  --invoml-color-accent: #111111;
  --invoml-color-accent-soft: #ffffff;
  --invoml-color-text: #111111;
  --invoml-color-muted: #333333;
  --invoml-color-border: #111111;
  --invoml-color-border-soft: #777777;
  --invoml-padding-y: 15mm;
  --invoml-padding-x: 15mm;
  --invoml-section-gap: 14px;
  --invoml-table-row-padding: 7px;
  --invoml-parties-gap: 24px;
  --invoml-payment-margin-top: 20px;
  --invoml-meta-gap: 14px;
  --invoml-totals-margin: 14px;
  --invoml-line-height: 1.35;
  --invoml-paragraph-spacing: 8px;
}
.invoml-container[data-invoml-template="professional"] .invoml-header {
  border-bottom: 3px solid #111111;
  padding-bottom: 12px;
}
.invoml-container[data-invoml-template="professional"] .invoml-header-number {
  background: none;
  padding: 0;
  border-radius: 0;
}
.invoml-container[data-invoml-template="professional"] .invoml-items th {
  border-top: 2px solid #111111;
  border-bottom: 2px solid #111111;
}
.invoml-container[data-invoml-template="professional"] .invoml-items tbody tr:last-child td {
  border-bottom: 2px solid #111111;
}
.invoml-container[data-invoml-template="professional"] .invoml-section-title {
  text-transform: none;
  letter-spacing: normal;
  font-size: 16px;
}
`,
}
