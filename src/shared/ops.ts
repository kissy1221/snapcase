import { GROUP_NONE } from './constants'
import type { Block, Entry, Manifest, Meta, Result, TestCase } from './types'

/** manifest を変える操作。main が apply し、保存して全ウィンドウに通知する。 */
export type Op =
  | { t: 'setMeta'; meta: Meta }
  | { t: 'addTestCase'; tc: Partial<Omit<TestCase, 'entries'>> }
  | { t: 'addTestCases'; tcs: Partial<Omit<TestCase, 'entries'>>[] }
  | { t: 'updateTestCase'; id: string; patch: Partial<Omit<TestCase, 'entries'>> }
  | { t: 'deleteTestCase'; id: string }
  /** id を toGroup の beforeId の直前へ(beforeId=null は末尾)。ドラッグ＆ドロップ用。 */
  | { t: 'moveTestCase'; id: string; toGroup: string; beforeId: string | null }
  | { t: 'moveTestCaseBy'; id: string; delta: -1 | 1 }
  | { t: 'moveGroup'; name: string; delta: -1 | 1 }
  | { t: 'addEntry'; tcId: string; blocks: Block[]; comment?: string; time?: string }
  | { t: 'setEntryComment'; tcId: string; no: number; comment: string }
  | { t: 'deleteEntry'; tcId: string; no: number }
  | { t: 'moveEntry'; tcId: string; no: number; delta: -1 | 1 }
  | { t: 'addBlock'; tcId: string; no: number; block: Block }
  | { t: 'updateBlock'; tcId: string; no: number; index: number; block: Block }
  | { t: 'deleteBlock'; tcId: string; no: number; index: number }
  | { t: 'undoLast' }

export interface Applied {
  manifest: Manifest
  /** 参照されなくなった画像ファイル名。main が images/ から削除する。 */
  removedImages: string[]
}

const groupOf = (tc: TestCase): string => (tc.group || '').trim()

export function emptyManifest(session: string): Manifest {
  return { version: 3, session, meta: {}, testcases: [] }
}

const imagesOf = (e: Entry): string[] =>
  e.blocks.flatMap((b) => (b.type === 'image' && b.image ? [b.image] : []))

export function newTestCase(m: Manifest, p: Partial<Omit<TestCase, 'entries'>> = {}): TestCase {
  return {
    id: p.id?.trim() || nextTcId(m),
    title: p.title?.trim() || '(無題)',
    group: (p.group ?? '').trim(),
    category: (p.category ?? '').trim(),
    precondition: p.precondition ?? '',
    steps: p.steps ?? '',
    expected: p.expected ?? '',
    result: p.result || '未実施',
    note: p.note ?? '',
    entries: []
  }
}

export function nextTcId(m: Manifest): string {
  return 'TC-' + String(m.testcases.length + 1).padStart(3, '0')
}

/** 削除しても衝突しない、再利用しない記録番号。 */
export function nextNo(m: Manifest): number {
  return 1 + Math.max(0, ...m.testcases.flatMap((tc) => tc.entries.map((e) => e.no)))
}

/** 画像ファイル名(0001.png…)。全画像ブロックの最大番号+1。 */
export function nextImageName(m: Manifest): string {
  let max = 0
  for (const tc of m.testcases)
    for (const e of tc.entries)
      for (const img of imagesOf(e)) {
        const stem = img.replace(/\.[^.]*$/, '')
        if (/^\d+$/.test(stem)) max = Math.max(max, Number(stem))
      }
  return String(max + 1).padStart(4, '0') + '.png'
}

/** フォルダ(初出順)ごとの testcases 添字。表示・出力の順序の正本。 */
export function orderedGroups(m: Manifest): { name: string; indexes: number[] }[] {
  const out: { name: string; indexes: number[] }[] = []
  m.testcases.forEach((tc, i) => {
    const name = groupOf(tc) || GROUP_NONE
    const g = out.find((x) => x.name === name)
    if (g) g.indexes.push(i)
    else out.push({ name, indexes: [i] })
  })
  return out
}

/** 旧スキーマ(最旧: フラット配列 / shots)や欠落を補い、現行の形に揃える。 */
export function normalize(raw: unknown, session: string): Manifest {
  const m = emptyManifest(session)
  let tcs: any[] = []
  if (Array.isArray(raw)) {
    if (raw.length) tcs = [{ id: 'TC-001', title: '(既存ステップ)', shots: raw }]
  } else if (raw && typeof raw === 'object') {
    const r = raw as any
    tcs = Array.isArray(r.testcases) ? r.testcases : []
    m.meta = r.meta || {}
    m.session = r.session || session
  }
  m.testcases = tcs.map((t) => {
    const entries: Entry[] = Array.isArray(t.entries)
      ? t.entries
      : (t.shots ?? []).map((sh: any, i: number) => ({
          no: sh.no ?? i + 1,
          time: sh.time ?? '',
          comment: sh.comment ?? '',
          blocks: [{ type: 'image', image: sh.image ?? '', title: sh.title ?? '', url: sh.url ?? '' }]
        }))
    const tc = newTestCase(m, { ...t, result: (t.result || '未実施') as Result })
    tc.entries = entries.map((e) => ({ ...e, blocks: e.blocks ?? [] }))
    return tc
  })
  return m
}

const now = (): string => {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** 元の manifest は変更せず、新しい manifest を返す。対象が無い操作は何もしない。 */
export function apply(src: Manifest, op: Op): Applied {
  const m: Manifest = structuredClone(src)
  const removed: string[] = []
  const tcOf = (id: string): TestCase | undefined => m.testcases.find((t) => t.id === id)
  const entryOf = (tcId: string, no: number): { tc: TestCase; i: number } | undefined => {
    const tc = tcOf(tcId)
    const i = tc ? tc.entries.findIndex((e) => e.no === no) : -1
    return tc && i >= 0 ? { tc, i } : undefined
  }
  const swap = <T>(a: T[], i: number, j: number): void => {
    if (j >= 0 && j < a.length) [a[i], a[j]] = [a[j], a[i]]
  }

  switch (op.t) {
    case 'setMeta':
      m.meta = { ...m.meta, ...op.meta }
      break
    case 'addTestCase':
      m.testcases.push(newTestCase(m, op.tc))
      break
    case 'addTestCases':
      for (const p of op.tcs) m.testcases.push(newTestCase(m, p))
      break
    case 'updateTestCase': {
      const tc = tcOf(op.id)
      if (tc) Object.assign(tc, op.patch, { group: (op.patch.group ?? tc.group).trim() })
      break
    }
    case 'deleteTestCase': {
      const i = m.testcases.findIndex((t) => t.id === op.id)
      if (i >= 0) for (const e of m.testcases.splice(i, 1)[0].entries) removed.push(...imagesOf(e))
      break
    }
    case 'moveTestCase': {
      const i = m.testcases.findIndex((t) => t.id === op.id)
      if (i < 0) break
      const [tc] = m.testcases.splice(i, 1)
      tc.group = op.toGroup === GROUP_NONE ? '' : op.toGroup.trim()
      let at = op.beforeId ? m.testcases.findIndex((t) => t.id === op.beforeId) : -1
      if (at < 0) {
        // 末尾 = 同フォルダの最後の直後。フォルダが空なら全体の末尾。
        const last = m.testcases.map(groupOf).lastIndexOf(tc.group)
        at = last < 0 ? m.testcases.length : last + 1
      }
      m.testcases.splice(at, 0, tc)
      break
    }
    case 'moveTestCaseBy': {
      const i = m.testcases.findIndex((t) => t.id === op.id)
      if (i < 0) break
      const g = groupOf(m.testcases[i])
      const sibs = m.testcases.flatMap((t, k) => (groupOf(t) === g ? [k] : []))
      const j = sibs[sibs.indexOf(i) + op.delta]
      if (j !== undefined) swap(m.testcases, i, j)
      break
    }
    case 'moveGroup': {
      const groups = orderedGroups(m).map((g) => g.name)
      const i = groups.indexOf(op.name)
      if (i < 0 || i + op.delta < 0 || i + op.delta >= groups.length) break
      swap(groups, i, i + op.delta)
      const buckets = new Map<string, TestCase[]>()
      for (const tc of m.testcases) {
        const k = groupOf(tc) || GROUP_NONE
        buckets.set(k, [...(buckets.get(k) ?? []), tc])
      }
      m.testcases = groups.flatMap((g) => buckets.get(g) ?? [])
      break
    }
    case 'addEntry': {
      const tc = tcOf(op.tcId)
      if (tc)
        tc.entries.push({
          no: nextNo(m),
          time: op.time ?? now(),
          comment: op.comment ?? '',
          blocks: op.blocks
        })
      break
    }
    case 'setEntryComment': {
      const h = entryOf(op.tcId, op.no)
      if (h) h.tc.entries[h.i].comment = op.comment
      break
    }
    case 'deleteEntry': {
      const h = entryOf(op.tcId, op.no)
      if (h) removed.push(...imagesOf(h.tc.entries.splice(h.i, 1)[0]))
      break
    }
    case 'moveEntry': {
      const h = entryOf(op.tcId, op.no)
      if (h) swap(h.tc.entries, h.i, h.i + op.delta)
      break
    }
    case 'addBlock': {
      const h = entryOf(op.tcId, op.no)
      if (h) h.tc.entries[h.i].blocks.push(op.block)
      break
    }
    case 'updateBlock': {
      const h = entryOf(op.tcId, op.no)
      const blocks = h?.tc.entries[h.i].blocks
      if (blocks && op.index >= 0 && op.index < blocks.length) blocks[op.index] = op.block
      break
    }
    case 'deleteBlock': {
      const h = entryOf(op.tcId, op.no)
      if (!h) break
      const e = h.tc.entries[h.i]
      if (op.index < 0 || op.index >= e.blocks.length) break
      const [b] = e.blocks.splice(op.index, 1)
      if (b.type === 'image' && b.image) removed.push(b.image)
      if (!e.blocks.length) h.tc.entries.splice(h.i, 1) // ブロックが無い記録は残さない
      break
    }
    case 'undoLast': {
      // 最後に追加した記録 = 番号が最大の記録。並べ替えても「直前に撮ったもの」を消せる。
      const target = m.testcases
        .flatMap((tc) => tc.entries.map((e) => ({ tc, e })))
        .sort((a, b) => b.e.no - a.e.no)[0]
      if (target) {
        target.tc.entries.splice(target.tc.entries.indexOf(target.e), 1)
        removed.push(...imagesOf(target.e))
      }
      break
    }
  }
  return { manifest: m, removedImages: removed }
}
