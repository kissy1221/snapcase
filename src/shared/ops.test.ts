import { describe, expect, it } from 'vitest'
import { GROUP_NONE } from './constants'
import { apply, emptyManifest, nextImageName, nextNo, normalize, orderedGroups, type Op } from './ops'
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
    const m = normalize([{ no: 3, time: 't', comment: 'c', image: '0003.png', title: 'w', url: 'u' }], 's')
    expect(m.testcases).toHaveLength(1)
    expect(m.testcases[0].entries[0]).toEqual({
      no: 3, time: 't', comment: 'c',
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
    expect(m.testcases.map((t) => [t.id, t.group])).toEqual([['A', 'g1'], ['B', 'g2'], ['D', 'g1'], ['C', 'g1']])
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
    expect(apply(m, { t: 'deleteEntry', tcId: 'A', no: 2 }).removedImages).toEqual(['0002.png', '0003.png'])
    expect(apply(m, { t: 'deleteTestCase', id: 'A' }).removedImages).toEqual(['0001.png', '0002.png', '0003.png'])
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
