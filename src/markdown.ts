/** Escape HTML special characters in plain text. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Process inline markdown: bold, italic, underline, links.
 *  HTML is escaped first to prevent XSS — Markdown patterns are applied on safe text. */
export function processInline(text: string): string {
  let result = escapeHtml(text)
  // Links: only allow http, https, and mailto schemes.
  // Anything else (data:, javascript:, vbscript:, etc.) is stripped to plain text.
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText: string, url: string) => {
    if (/^https?:/i.test(url) || /^mailto:/i.test(url)) {
      // url is already HTML-escaped from the escapeHtml pass above — use directly
      return `<a href="${url}">${linkText}</a>`
    }
    return linkText
  })
  // Bold **text**
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // Italic *text*
  result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  // Underline __text__
  result = result.replace(/__([^_]+)__/g, '<u>$1</u>')
  return result
}

/** Process the supported markdown subset into HTML inline/block content.
 *  Supports: bold, italic, underline, links, ATX headings 1–3, unordered lists,
 *  and ordered lists.
 *
 *  Structural section titles remain the preferred top-level document hierarchy.
 *  ATX headings provide nested hierarchy within markdown-block fields without
 *  requiring lossy conversion into additional InvoML sections. */
export function processMarkdown(text: string): string {
  const lines = text.split('\n')
  const output: string[] = []
  let inUl = false
  let inOl = false

  function closeList(): void {
    if (inUl) { output.push('</ul>'); inUl = false }
    if (inOl) { output.push('</ol>'); inOl = false }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const ulMatch = /^[-*]\s+(.+)$/.exec(line)
    const olMatch = /^\d+\.\s+(.+)$/.exec(line)
    const headingMatch = /^(#{1,3})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(line)

    if (headingMatch) {
      closeList()
      const level = headingMatch[1].length
      output.push(`<h${level}>${processInline(headingMatch[2])}</h${level}>`)
    } else if (ulMatch) {
      if (inOl) { output.push('</ol>'); inOl = false }
      if (!inUl) { output.push('<ul>'); inUl = true }
      output.push(`<li>${processInline(ulMatch[1])}</li>`)
    } else if (olMatch) {
      if (inUl) { output.push('</ul>'); inUl = false }
      if (!inOl) { output.push('<ol>'); inOl = true }
      output.push(`<li>${processInline(olMatch[1])}</li>`)
    } else if (line.trim() === '') {
      closeList()
      // Do not insert <br> before list items — the list element itself provides the visual break
      if (i + 1 < lines.length && lines[i + 1].trim() !== '' &&
          !/^[-*]\s/.test(lines[i + 1]) && !/^\d+\.\s/.test(lines[i + 1])) {
        output.push('<br>')
      }
    } else {
      closeList()
      output.push(processInline(line))
      if (i + 1 < lines.length && lines[i + 1].trim() !== '' &&
          !/^[-*]\s/.test(lines[i + 1]) && !/^\d+\.\s/.test(lines[i + 1]) &&
          !/^#{1,3}[ \t]+/.test(lines[i + 1])) {
        output.push('<br>')
      }
    }
  }

  closeList()
  return output.join('\n')
}
