import { expect, it } from 'vitest'
import { parseTable, tableToText } from './parse'

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

it('表を編集用テキストへ戻して再解析しても同じになる', () => {
  const t = { columns: ['a', 'b'], rows: [['1', '2']] }
  expect(parseTable(tableToText(t.columns, t.rows), true)).toEqual(t)
})
