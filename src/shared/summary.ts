import { orderedGroups } from './ops'
import type { Manifest, Result, TestCase } from './types'

export type Tally = Record<Result, number> & { total: number }

export function tally(tcs: TestCase[]): Tally {
  const t = { total: tcs.length, 未実施: 0, OK: 0, NG: 0, 保留: 0 } as Tally
  for (const tc of tcs) t[tc.result]++
  return t
}

/** 実施率 = 未実施以外の割合。合格率 = OK ÷ (OK + NG)。どちらも母数が 0 のときは null。 */
export const doneRate = (t: Tally): number | null =>
  t.total ? (t.total - t.未実施) / t.total : null
export const passRate = (t: Tally): number | null => (t.OK + t.NG ? t.OK / (t.OK + t.NG) : null)

export interface Summary {
  all: Tally
  groups: { name: string; tally: Tally }[]
  /** ステップの総数 */
  steps: number
}

export function summarize(m: Manifest): Summary {
  return {
    all: tally(m.testcases),
    groups: orderedGroups(m).map((g) => ({
      name: g.name,
      tally: tally(g.indexes.map((i) => m.testcases[i]))
    })),
    steps: m.testcases.reduce((n, t) => n + t.entries.length, 0)
  }
}
