/** 貼り付けテキストを表に分解する。1行ずつ、タブがあればタブ区切り、無ければカンマ区切り。 */
export function parseTable(
  text: string,
  header: boolean
): { columns: string[]; rows: string[][] } {
  const cells = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => l.split(l.includes('\t') ? '\t' : ',').map((c) => c.trim()))
  if (!cells.length) return { columns: [], rows: [] }
  const n = Math.max(...cells.map((r) => r.length))
  const rows = cells.map((r) => [...r, ...Array(n - r.length).fill('')])
  return header ? { columns: rows[0], rows: rows.slice(1) } : { columns: [], rows }
}

/** 1行=1リンク。「ラベル<Tab>URL」「ラベル|URL」または「URL」。URL が空の行は捨てる。 */
export function parseLinks(text: string): { label: string; url: string }[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const sep = l.includes('\t') ? '\t' : l.includes('|') ? '|' : ''
      const [label, url] = sep ? [l.slice(0, l.indexOf(sep)), l.slice(l.indexOf(sep) + 1)] : ['', l]
      return { label: label.trim(), url: url.trim() }
    })
    .filter((x) => x.url)
}

/** 表・リンクを編集画面のテキストへ戻す(parse の逆)。 */
export const tableToText = (columns: string[], rows: string[][]): string =>
  [...(columns.length ? [columns] : []), ...rows].map((r) => r.join('\t')).join('\n')

export const linksToText = (links: { label: string; url: string }[]): string =>
  links.map((l) => (l.label ? `${l.label}\t${l.url}` : l.url)).join('\n')
