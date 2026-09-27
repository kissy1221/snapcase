import { META_FIELDS } from '../../shared/constants'
import { displayNumbers, orderedGroups } from '../../shared/ops'
import type { Entry, Manifest, TestCase } from '../../shared/types'

/** 書き出し用に、フォルダ順・通し番号を確定させた文書。HTML / Markdown / Excel の共通の入力。 */
export interface Doc {
  name: string
  generated: string
  meta: [label: string, value: string][]
  entryCount: number
  groups: {
    name: string
    tcs: { tc: TestCase; anchor: string; entries: { e: Entry; seq: number }[] }[]
  }[]
  /** 画像ファイル名 → 中身(無ければ null) */
  readImage: (name: string) => Buffer | null
}

export function buildDoc(m: Manifest, readImage: Doc['readImage'], now = new Date()): Doc {
  const seqOf = displayNumbers(m)
  const p = (n: number): string => String(n).padStart(2, '0')
  let n = 0
  return {
    name: m.session,
    generated: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`,
    meta: META_FIELDS.flatMap(([k, label]) =>
      m.meta[k] ? [[label, m.meta[k]] as [string, string]] : []
    ),
    entryCount: seqOf.size,
    groups: orderedGroups(m).map((g) => ({
      name: g.name,
      tcs: g.indexes.map((i) => ({
        tc: m.testcases[i],
        anchor: `tc${++n}`,
        entries: m.testcases[i].entries.map((e) => ({ e, seq: seqOf.get(e.no)! }))
      }))
    })),
    readImage
  }
}
