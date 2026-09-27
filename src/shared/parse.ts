/** 貼り付けテキストを表に分解する。1行ずつ、タブがあればタブ区切り、無ければカンマ区切り。 */
export function parseTable(text: string, header: boolean): { columns: string[]; rows: string[][] } {
  const cells = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => l.split(l.includes('\t') ? '\t' : ',').map((c) => c.trim()))
  if (!cells.length) return { columns: [], rows: [] }
  const n = Math.max(...cells.map((r) => r.length))
  const rows = cells.map((r) => [...r, ...Array(n - r.length).fill('')])
  return header ? { columns: rows[0], rows: rows.slice(1) } : { columns: [], rows }
}

/** 表を編集画面のテキストへ戻す(parseTable の逆)。 */
export const tableToText = (columns: string[], rows: string[][]): string =>
  [...(columns.length ? [columns] : []), ...rows].map((r) => r.join('\t')).join('\n')
