import { expect, it } from 'vitest'
import { casesFromRows, decodeCsv, matchColumns, normalizeResult, parseCsv } from './import'

it('見出しの別名から列を割り当てる。英語の note が id に誤認されない', () => {
  const m = matchColumns(['No', '機能', 'テスト項目', '観点', '期待値', '合否', 'Note'])
  expect([...m.values()]).toEqual([
    'id',
    'group',
    'title',
    'category',
    'expected',
    'result',
    'note'
  ])
})

it('判定の表記ゆれを吸収する', () => {
  expect(['○', 'Pass', '合格', '×', 'FAIL', '△', '-', '', 'なにか'].map(normalizeResult)).toEqual([
    'OK',
    'OK',
    'OK',
    'NG',
    'NG',
    '保留',
    '未実施',
    '未実施',
    '未実施'
  ])
})

it('空行を飛ばし、判定を正規化し、ID が空でも取り込む', () => {
  const rows = [
    ['', ''],
    ['ID', '項目名', '判定', '機能'],
    ['', 'ログイン', '○', '認証'],
    ['', '', '', ''],
    ['T-2', '', '不合格', '']
  ]
  expect(casesFromRows(rows)).toEqual([
    { id: '', title: 'ログイン', result: 'OK', group: '認証' },
    { id: 'T-2', title: '', result: 'NG', group: '' }
  ])
})

it('必須列が無い・データが無い・空のファイルはエラー', () => {
  expect(() =>
    casesFromRows([
      ['備考', '手順'],
      ['a', 'b']
    ])
  ).toThrow('項目名')
  expect(() => casesFromRows([['ID', '項目名']])).toThrow('データ行')
  expect(() => casesFromRows([[], ['']])).toThrow('空')
})

it('CSV: 引用符・エスケープ・引用符内の改行・CRLF', () => {
  expect(parseCsv('a,"b,1","c ""q""\nline2"\r\nx,,z')).toEqual([
    ['a', 'b,1', 'c "q"\nline2'],
    ['x', '', 'z']
  ])
})

it('文字コード: UTF-8(BOM付き)と Shift-JIS の両方を読める', () => {
  expect(decodeCsv(new Uint8Array([0xef, 0xbb, 0xbf, 0x41, 0xe3, 0x81, 0x82]))).toBe('Aあ')
  expect(decodeCsv(new Uint8Array([0x83, 0x65, 0x83, 0x58, 0x83, 0x67]))).toBe('テスト') // Shift-JIS
})
