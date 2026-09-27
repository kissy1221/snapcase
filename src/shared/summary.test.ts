import { expect, it } from 'vitest'
import { GROUP_NONE } from './constants'
import { apply, emptyManifest, type Op } from './ops'
import { doneRate, passRate, summarize, tally } from './summary'

const m = (['OK', 'NG', 'NG', '保留', '未実施'] as const).reduce(
  (acc, r, i) =>
    apply(acc, { t: 'addTestCase', tc: { result: r, group: i < 3 ? '認証' : '' } } as Op).manifest,
  emptyManifest('s')
)

it('判定ごとの件数・実施率・合格率', () => {
  const t = tally(m.testcases)
  expect(t).toEqual({ total: 5, OK: 1, NG: 2, 保留: 1, 未実施: 1 })
  expect(doneRate(t)).toBeCloseTo(0.8)
  expect(passRate(t)).toBeCloseTo(1 / 3)
})

it('母数が 0 のときは割合を出さない(0 除算しない)', () => {
  const t = tally([])
  expect(doneRate(t)).toBeNull()
  expect(passRate(t)).toBeNull()
  expect(passRate(tally(m.testcases.filter((x) => x.result === '保留')))).toBeNull() // OK も NG も無い
})

it('フォルダ別の内訳は表示順で、未分類も含む', () => {
  const s = summarize(
    apply(m, { t: 'addEntry', tcId: 'TC-001', blocks: [{ type: 'note', text: 'n' }] }).manifest
  )
  expect(s.groups.map((g) => [g.name, g.tally.total])).toEqual([
    ['認証', 3],
    [GROUP_NONE, 2]
  ])
  expect(s.groups[0].tally).toMatchObject({ OK: 1, NG: 2 })
  expect(s.steps).toBe(1)
})
