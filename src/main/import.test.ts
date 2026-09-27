import ExcelJS from 'exceljs'
import { mkdtemp, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { expect, it } from 'vitest'
import { loadTestCases } from './import'

const tmp = async (name: string): Promise<string> =>
  join(await mkdtemp(join(tmpdir(), 'imp-')), name)

it('xlsx: 見出しの別名・判定の表記ゆれ・書式付きセル・数式を読める', async () => {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('仕様')
  ws.addRow(['項番', 'フォルダ', '確認内容', '合否'])
  ws.addRow([1, '認証', { richText: [{ text: 'ログイン' }, { text: 'できる' }] }, '○'])
  ws.addRow([2, '認証', 'ロック', { formula: '"NG"', result: 'NG' }])
  const p = await tmp('a.xlsx')
  await wb.xlsx.writeFile(p)
  expect(await loadTestCases(p)).toEqual([
    { id: '1', group: '認証', title: 'ログインできる', result: 'OK' },
    { id: '2', group: '認証', title: 'ロック', result: 'NG' }
  ])
})

it('csv: Shift-JIS でも読める', async () => {
  const p = await tmp('a.csv')
  // "項目名\nテスト" を Shift-JIS で。
  await writeFile(
    p,
    Buffer.from([0x8d, 0x80, 0x96, 0xda, 0x96, 0xbc, 0x0a, 0x83, 0x65, 0x83, 0x58, 0x83, 0x67])
  )
  expect(await loadTestCases(p)).toEqual([{ title: 'テスト', result: '未実施' }])
})

it('対応していない拡張子は利用者向けのメッセージで失敗する', async () => {
  await expect(loadTestCases(await tmp('a.txt'))).rejects.toThrow('対応していない形式')
})
