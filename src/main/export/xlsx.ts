import ExcelJS from 'exceljs'
import { BANNER_LEVELS } from '../../shared/constants'
import type { Doc } from './model'

const bannerLabel = (l: string): string => BANNER_LEVELS.find(([k]) => k === l)?.[1] ?? 'バナー'
const thin = { style: 'thin', color: { argb: 'FFCCCCCC' } } as const
const BORDER = { left: thin, right: thin, top: thin, bottom: thin }
const fill = (argb: string): ExcelJS.Fill => ({
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb }
})
const HEAD = fill('FFE8EEF7')

/** PNG の幅・高さ(IHDR)。 */
export const pngSize = (b: Buffer): { w: number; h: number } => ({
  w: b.readUInt32BE(16),
  h: b.readUInt32BE(20)
})

export async function renderXlsx(d: Doc): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('証跡', { views: [{ showGridLines: false }] })
  ws.getColumn(1).width = 24
  ws.getColumn(2).width = 110
  let r = 0

  /** 1行書く。label は太字。border を付けるのは表の行だけ。 */
  const put = (
    a: string,
    b: string,
    o: { head?: boolean; fill?: ExcelJS.Fill; size?: number; mono?: boolean; border?: boolean } = {}
  ): ExcelJS.Row => {
    const row = ws.getRow(++r)
    row.getCell(1).value = a
    row.getCell(2).value = b
    for (const c of [1, 2]) {
      const cell = row.getCell(c)
      cell.alignment = { wrapText: true, vertical: 'top' }
      if (o.fill) cell.fill = o.fill
      if (o.border ?? true) cell.border = BORDER
    }
    row.getCell(1).font = { bold: true, size: o.size }
    row.getCell(2).font = { bold: !!o.head, name: o.mono ? 'Consolas' : undefined, size: o.size }
    return row
  }

  ws.getCell(++r, 1).value = `テスト証跡: ${d.name}`
  ws.getCell(r, 1).font = { bold: true, size: 14 }
  ws.getCell(++r, 1).value = `生成: ${d.generated} ／ 証跡 ${d.entryCount}件`
  ws.getCell(r, 1).font = { color: { argb: 'FF666666' } }
  r++

  if (d.meta.length) {
    put('実施情報', '', { fill: HEAD, border: false })
    for (const [l, v] of d.meta) put(l, v)
    r++
  }

  for (const g of d.groups) {
    put(`■ ${g.name}`, '', { fill: fill('FFC9D6E5'), size: 12, border: false })
    for (const { tc, entries } of g.tcs) {
      put(
        `${tc.id} ： ${tc.title}${tc.category ? `\u3000［${tc.category}］` : ''}`,
        `判定: ${tc.result}`,
        {
          fill: fill('FFDCE6F1'),
          head: true,
          size: 11,
          border: false
        }
      )
      for (const [k, l] of [
        ['precondition', '前提条件'],
        ['steps', '手順'],
        ['expected', '期待結果'],
        ['note', '備考']
      ] as const)
        if (tc[k]) put(l, tc[k])
      for (const { e, seq } of entries) {
        put(`No.${seq}  ${e.time}`, '', { fill: HEAD, border: false })
        if (e.comment) put('操作/確認', e.comment)
        for (const b of e.blocks) {
          switch (b.type) {
            case 'image': {
              const info = [b.title && `Window: ${b.title}`, b.url && `URL: ${b.url}`]
                .filter(Boolean)
                .join('\n')
              if (info) put('', info)
              const png = b.image ? d.readImage(b.image) : null
              if (!png) {
                put('', `(画像を読み込めませんでした: ${b.image})`)
                break
              }
              const { w, h } = pngSize(png)
              const s = Math.min(1, 900 / w, 540 / h) // Excel の行の高さの上限(409pt)に収まる範囲
              const id = wb.addImage({ buffer: png as unknown as ExcelJS.Buffer, extension: 'png' })
              ws.getRow(r + 1).height = h * s * 0.75
              ws.addImage(id, { tl: { col: 0, row: r }, ext: { width: w * s, height: h * s } })
              r++
              break
            }
            case 'code':
              put(b.label || 'コード', b.text, { mono: true })
              break
            case 'table':
              if (b.label) put(b.label, '')
              if (b.columns.length) {
                const row = ws.getRow(++r)
                b.columns.forEach((c, i) =>
                  Object.assign(row.getCell(i + 1), {
                    value: c,
                    font: { bold: true },
                    fill: HEAD,
                    border: BORDER
                  })
                )
              }
              for (const cells of b.rows) {
                const row = ws.getRow(++r)
                cells.forEach((c, i) =>
                  Object.assign(row.getCell(i + 1), {
                    value: c,
                    border: BORDER,
                    alignment: { wrapText: true, vertical: 'top' }
                  })
                )
              }
              break
            case 'note':
              put('補足メモ', b.text)
              break
            case 'expect':
              put('期待結果', b.expected)
              put('実際の結果', b.actual + (b.verdict ? `\u3000［${b.verdict}］` : ''))
              break
            case 'banner':
              put(bannerLabel(b.level), b.text)
              break
            case 'link':
              put('参照', b.links.map((l) => (l.label ? `${l.label}: ${l.url}` : l.url)).join('\n'))
              break
          }
        }
        r++
      }
      r++
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}
