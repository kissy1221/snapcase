import { expect, it } from 'vitest'
import { linksToText, parseLinks, parseTable, tableToText } from './parse'

it('parseTable: タブ優先・カンマ可・列数を揃える・空行を飛ばす', () => {
  expect(parseTable('a\tb\n\n1\t2,3\n4', true)).toEqual({
    columns: ['a', 'b'],
    rows: [
      ['1', '2,3'],
      ['4', '']
    ]
  })
  expect(parseTable('a,b\n1,2', false)).toEqual({
    columns: [],
    rows: [
      ['a', 'b'],
      ['1', '2']
    ]
  })
  expect(parseTable('  \n', true)).toEqual({ columns: [], rows: [] })
})

it('parseLinks: タブ・パイプ・URLのみ。URL が空の行は捨てる', () => {
  expect(parseLinks('#1\thttp://a\nラベル|http://b\nhttp://c\nラベルだけ|')).toEqual([
    { label: '#1', url: 'http://a' },
    { label: 'ラベル', url: 'http://b' },
    { label: '', url: 'http://c' }
  ])
})

it('編集用テキストへ戻して再解析しても同じになる', () => {
  const t = { columns: ['a', 'b'], rows: [['1', '2']] }
  expect(parseTable(tableToText(t.columns, t.rows), true)).toEqual(t)
  const l = [
    { label: 'x', url: 'http://x' },
    { label: '', url: 'http://y' }
  ]
  expect(parseLinks(linksToText(l))).toEqual(l)
})
