import ExcelJS from 'exceljs'
import { readFile } from 'fs/promises'
import { extname } from 'path'
import { casesFromRows, decodeCsv, parseCsv, type ImportedCase } from '../shared/import'

/** セルの値を文字列にする(書式付き文字列・数式・リンク・日付を含む)。 */
function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('')
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue)
    if ('text' in v) return String(v.text)
    if ('error' in v) return ''
  }
  return String(v)
}

/** CSV / Excel(.xlsx, .xlsm)からテストケース定義を読む。読めなければ Error(メッセージは利用者向け)。 */
export async function loadTestCases(path: string): Promise<ImportedCase[]> {
  const ext = extname(path).toLowerCase()
  if (ext === '.csv') return casesFromRows(parseCsv(decodeCsv(await readFile(path))))
  if (ext === '.xlsx' || ext === '.xlsm') {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(path)
    const ws = wb.worksheets[0]
    if (!ws) throw new Error('空のファイルです。')
    const rows: string[][] = []
    ws.eachRow({ includeEmpty: true }, (row) => {
      const cells: string[] = []
      row.eachCell({ includeEmpty: true }, (c, col) => (cells[col - 1] = cellText(c.value)))
      rows.push(Array.from(cells, (c) => c ?? ''))
    })
    return casesFromRows(rows)
  }
  throw new Error('対応していない形式です（.csv / .xlsx を指定してください）。')
}
