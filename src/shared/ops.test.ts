import { describe, expect, it } from 'vitest'
import { GROUP_NONE } from './constants'
import {
  apply,
  displayNumbers,
  emptyManifest,
  nextImageName,
  nextNo,
  nextTcId,
  normalize,
  orderedGroups,
  type Op
} from './ops'
import type { Block, Manifest } from './types'

const img = (name: string): Block => ({ type: 'image', image: name, title: '', url: '' })

function run(m: Manifest, ...ops: Op[]): Manifest {
  return ops.reduce((acc, op) => apply(acc, op).manifest, m)
}
const ids = (m: Manifest): string[] => m.testcases.map((t) => t.id)

const base = (): Manifest =>
  run(
    emptyManifest('s'),
    { t: 'addTestCase', tc: { id: 'A', group: 'g1' } },
    { t: 'addTestCase', tc: { id: 'B', group: 'g2' } },
    { t: 'addTestCase', tc: { id: 'C', group: 'g1' } },
    { t: 'addTestCase', tc: { id: 'D' } }
  )

describe('normalize', () => {
  it('最旧のフラット配列を1テストケースに包み、shots を entries+image ブロックへ変換する', () => {
    const m = normalize(
      [{ no: 3, time: 't', comment: 'c', image: '0003.png', title: 'w', url: 'u' }],
      's'
    )
    expect(m.testcases).toHaveLength(1)
    expect(m.testcases[0].entries[0]).toEqual({
      no: 3,
      time: 't',
      comment: 'c',
      blocks: [{ type: 'image', image: '0003.png', title: 'w', url: 'u' }]
    })
  })
  it('未実施の空文字と欠落フィールドを補う', () => {
    const m = normalize({ testcases: [{ id: 'X', title: 'x', result: '', entries: [] }] }, 's')
    expect(m.testcases[0]).toMatchObject({ result: '未実施', group: '', category: '', note: '' })
  })
})

describe('並べ替え', () => {
  it('フォルダは初出順。moveGroup でフォルダごと入れ替わり、中の順序は保たれる', () => {
    let m = base()
    expect(orderedGroups(m).map((g) => g.name)).toEqual(['g1', 'g2', GROUP_NONE])
    m = run(m, { t: 'moveGroup', name: 'g2', delta: -1 })
    expect(ids(m)).toEqual(['B', 'A', 'C', 'D'])
    m = run(m, { t: 'moveGroup', name: 'g1', delta: 1 })
    expect(ids(m)).toEqual(['B', 'D', 'A', 'C'])
  })
  it('moveTestCaseBy は同じフォルダ内だけで動く', () => {
    let m = run(base(), { t: 'moveTestCaseBy', id: 'A', delta: 1 })
    expect(ids(m)).toEqual(['C', 'B', 'A', 'D'])
    m = run(m, { t: 'moveTestCaseBy', id: 'A', delta: 1 })
    expect(ids(m)).toEqual(['C', 'B', 'A', 'D'])
  })
  it('moveTestCase で別フォルダの指定位置・末尾・未分類へ移せる', () => {
    let m = run(base(), { t: 'moveTestCase', id: 'D', toGroup: 'g1', beforeId: 'C' })
    expect(m.testcases.map((t) => [t.id, t.group])).toEqual([
      ['A', 'g1'],
      ['B', 'g2'],
      ['D', 'g1'],
      ['C', 'g1']
    ])
    m = run(m, { t: 'moveTestCase', id: 'A', toGroup: 'g2', beforeId: null })
    expect(ids(m)).toEqual(['B', 'A', 'D', 'C'])
    m = run(m, { t: 'moveTestCase', id: 'B', toGroup: GROUP_NONE, beforeId: null })
    expect(m.testcases.find((t) => t.id === 'B')?.group).toBe('')
  })
})

describe('記録とブロック', () => {
  const withEntries = (): Manifest =>
    run(
      base(),
      { t: 'addEntry', tcId: 'A', blocks: [img('0001.png')] },
      { t: 'addEntry', tcId: 'A', blocks: [img('0002.png'), img('0003.png')] },
      { t: 'addEntry', tcId: 'B', blocks: [{ type: 'note', text: 'n' }] }
    )
  it('番号と画像名は削除しても再利用されない', () => {
    let m = withEntries()
    expect(nextNo(m)).toBe(4)
    m = run(m, { t: 'deleteEntry', tcId: 'B', no: 3 })
    expect(nextNo(m)).toBe(3)
    expect(nextImageName(m)).toBe('0004.png')
    expect(nextImageName(emptyManifest('s'))).toBe('0001.png')
  })
  it('記録の削除・ブロックの全削除で、消える画像ファイルが返る', () => {
    const m = withEntries()
    expect(apply(m, { t: 'deleteEntry', tcId: 'A', no: 2 }).removedImages).toEqual([
      '0002.png',
      '0003.png'
    ])
    expect(apply(m, { t: 'deleteTestCase', id: 'A' }).removedImages).toEqual([
      '0001.png',
      '0002.png',
      '0003.png'
    ])
    const one = apply(m, { t: 'deleteBlock', tcId: 'A', no: 1, index: 0 })
    expect(one.removedImages).toEqual(['0001.png'])
    expect(one.manifest.testcases[0].entries.map((e) => e.no)).toEqual([2]) // 空の記録は消える
  })
  it('moveEntry は同じテストケース内で入れ替わり、端では何もしない', () => {
    let m = run(withEntries(), { t: 'moveEntry', tcId: 'A', no: 1, delta: 1 })
    expect(m.testcases[0].entries.map((e) => e.no)).toEqual([2, 1])
    m = run(m, { t: 'moveEntry', tcId: 'A', no: 1, delta: 1 })
    expect(m.testcases[0].entries.map((e) => e.no)).toEqual([2, 1])
  })
  it('undoLast は番号が最大の記録を消す', () => {
    const r = apply(withEntries(), { t: 'undoLast' })
    expect(r.manifest.testcases[1].entries).toHaveLength(0)
    expect(apply(emptyManifest('s'), { t: 'undoLast' }).removedImages).toEqual([])
  })
  it('元の manifest を変更しない', () => {
    const m = withEntries()
    const before = JSON.stringify(m)
    apply(m, { t: 'deleteTestCase', id: 'A' })
    expect(JSON.stringify(m)).toBe(before)
  })
})

describe('ID の一意性', () => {
  it('既存と同じ ID を追加しても重複しない(取り込み・ファイル内の重複も含む)', () => {
    const m = run(base(), { t: 'addTestCases', tcs: [{ id: 'A' }, { id: 'A' }, { id: 'X' }] })
    expect(ids(m)).toEqual(['A', 'B', 'C', 'D', 'A-2', 'A-3', 'X'])
  })
})

describe('採番と通し番号', () => {
  it('nextTcId は削除しても既存の ID と重ならない', () => {
    let m = run(
      emptyManifest('s'),
      { t: 'addTestCase', tc: {} },
      { t: 'addTestCase', tc: {} },
      { t: 'addTestCase', tc: {} }
    )
    m = run(m, { t: 'deleteTestCase', id: 'TC-002' })
    expect(nextTcId(m)).toBe('TC-004')
  })
  it('displayNumbers はフォルダ順・テストケース順で欠番なく振る', () => {
    const m = run(
      base(),
      { t: 'addEntry', tcId: 'B', blocks: [img('0001.png')] }, // no1 (g2)
      { t: 'addEntry', tcId: 'A', blocks: [img('0002.png')] }, // no2 (g1)
      { t: 'addEntry', tcId: 'D', blocks: [img('0003.png')] } // no3 (未分類)
    )
    expect([...displayNumbers(m)]).toEqual([
      [2, 1],
      [1, 2],
      [3, 3]
    ]) // g1 → g2 → 未分類の順
  })
  it('moveGroupTo でフォルダを指定位置・末尾へ移せる', () => {
    let m = run(base(), { t: 'moveGroupTo', name: GROUP_NONE, beforeName: 'g1' })
    expect(ids(m)).toEqual(['D', 'A', 'C', 'B'])
    m = run(m, { t: 'moveGroupTo', name: 'g1', beforeName: null })
    expect(ids(m)).toEqual(['D', 'B', 'A', 'C'])
  })
})

describe('記録とブロックの移動', () => {
  const two = (): Manifest =>
    run(
      base(),
      {
        t: 'addEntry',
        tcId: 'A',
        blocks: [img('1.png'), { type: 'note', text: 'n1' }, { type: 'note', text: 'n2' }]
      }, // no1
      { t: 'addEntry', tcId: 'A', blocks: [{ type: 'note', text: 'x' }] }, // no2
      { t: 'addEntry', tcId: 'B', blocks: [{ type: 'note', text: 'y' }] } // no3
    )
  const texts = (m: Manifest, tc: string, no: number): string[] =>
    m.testcases
      .find((t) => t.id === tc)!
      .entries.find((e) => e.no === no)!
      .blocks.map((b) => (b.type === 'note' ? b.text : b.type))

  it('moveEntryTo: 同じテストケース内で並べ替え、別のテストケースへも移せる', () => {
    let m = run(two(), { t: 'moveEntryTo', no: 2, toTcId: 'A', beforeNo: 1 })
    expect(m.testcases[0].entries.map((e) => e.no)).toEqual([2, 1])
    m = run(m, { t: 'moveEntryTo', no: 1, toTcId: 'B', beforeNo: null })
    expect(m.testcases[0].entries.map((e) => e.no)).toEqual([2])
    expect(m.testcases[1].entries.map((e) => e.no)).toEqual([3, 1])
    m = run(m, { t: 'moveEntryTo', no: 1, toTcId: 'B', beforeNo: 1 }) // 自分の前 = 何もしない
    expect(m.testcases[1].entries.map((e) => e.no)).toEqual([3, 1])
  })

  it('moveBlockTo: 同じ記録内では、前へも後ろへも動かせる', () => {
    let m = run(two(), { t: 'moveBlockTo', no: 1, index: 0, toNo: 1, toIndex: 3 }) // 末尾へ
    expect(texts(m, 'A', 1)).toEqual(['n1', 'n2', 'image'])
    m = run(m, { t: 'moveBlockTo', no: 1, index: 2, toNo: 1, toIndex: 0 }) // 先頭へ
    expect(texts(m, 'A', 1)).toEqual(['image', 'n1', 'n2'])
  })

  it('moveBlockTo: 記録をまたぐ。元の記録が空になったらその記録は消え、画像は消えない', () => {
    let m = run(two(), { t: 'moveBlockTo', no: 1, index: 1, toNo: 3, toIndex: 0 })
    expect(texts(m, 'B', 3)).toEqual(['n1', 'y'])
    const r = apply(m, { t: 'moveBlockTo', no: 2, index: 0, toNo: 1, toIndex: 0 })
    expect(r.manifest.testcases[0].entries.map((e) => e.no)).toEqual([1]) // no2 は空になり消える
    expect(r.removedImages).toEqual([])
    m = run(m, { t: 'moveBlockTo', no: 1, index: 0, toNo: 3, toIndex: 9 }) // 範囲外は末尾に丸める
    expect(texts(m, 'B', 3)).toEqual(['n1', 'y', 'image'])
  })

  it('moveBlockBy: 記録内で上下に入れ替え、端では隣の記録へ移る。移る先が無ければ何もしない', () => {
    let m = run(two(), { t: 'moveBlockBy', no: 1, index: 1, delta: 1 })
    expect(texts(m, 'A', 1)).toEqual(['image', 'n2', 'n1'])
    m = run(m, { t: 'moveBlockBy', no: 1, index: 2, delta: 1 }) // 下端 → 次の記録(no2)の先頭
    expect(texts(m, 'A', 1)).toEqual(['image', 'n2'])
    expect(texts(m, 'A', 2)).toEqual(['n1', 'x'])
    m = run(m, { t: 'moveBlockBy', no: 2, index: 0, delta: -1 }) // 上端 → 前の記録(no1)の末尾
    expect(texts(m, 'A', 1)).toEqual(['image', 'n2', 'n1'])
    m = run(m, { t: 'moveBlockBy', no: 1, index: 0, delta: -1 }) // 先頭の記録の上端 → 何もしない
    expect(texts(m, 'A', 1)).toEqual(['image', 'n2', 'n1'])
  })

  it('moveBlockBy: 記録の唯一のブロックを端から動かすと、空になった記録は消える', () => {
    const m = run(two(), { t: 'moveBlockBy', no: 2, index: 0, delta: -1 })
    expect(m.testcases[0].entries.map((e) => e.no)).toEqual([1])
    expect(texts(m, 'A', 1)).toEqual(['image', 'n1', 'n2', 'x'])
  })
})
