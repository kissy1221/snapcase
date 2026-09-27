import type { Result, TestCase } from './types'

export type ImportedCase = Partial<Omit<TestCase, 'entries'>>

const ALIASES: Record<string, string[]> = {
  id: [
    'id',
    'no',
    'no.',
    '番号',
    '項番',
    '項番号',
    '通番',
    'テストid',
    'ケースid',
    'ケースno',
    'tcid',
    'testid',
    'caseid'
  ],
  title: [
    '項目名',
    'タイトル',
    'テスト項目',
    'テストケース',
    '確認内容',
    'テスト内容',
    '項目',
    'ケース名',
    'テスト観点',
    'title',
    'name',
    'item'
  ],
  group: [
    'フォルダ',
    'グループ',
    '機能',
    '機能名',
    '分類グループ',
    'カテゴリ',
    '大項目',
    '中項目',
    '画面',
    'group',
    'folder',
    'category2',
    'feature'
  ],
  category: ['分類', '種別', 'テスト種別', '観点', '系', '正常異常', 'type', 'kind'],
  precondition: ['前提条件', '前提', '事前条件', '事前準備', 'precondition', '条件'],
  steps: [
    '手順',
    '操作手順',
    '操作',
    'テスト手順',
    '実施手順',
    '操作内容',
    'steps',
    'step',
    'procedure'
  ],
  expected: ['期待結果', '期待値', '想定結果', '期待', '確認結果', 'expected', '想定'],
  result: ['判定', '合否', 'テスト結果', '判定結果', '結果', 'result', 'status'],
  note: ['備考', 'メモ', '補足', 'コメント', 'note', 'notes', 'remarks']
}

const RESULT_ALIASES: Record<string, Result> = {
  ok: 'OK',
  '○': 'OK',
  '◯': 'OK',
  pass: 'OK',
  passed: 'OK',
  合格: 'OK',
  成功: 'OK',
  可: 'OK',
  good: 'OK',
  ng: 'NG',
  '×': 'NG',
  '✕': 'NG',
  fail: 'NG',
  failed: 'NG',
  不合格: 'NG',
  失敗: 'NG',
  不可: 'NG',
  保留: '保留',
  hold: '保留',
  pending: '保留',
  '△': '保留',
  未実施: '未実施',
  未: '未実施',
  未着手: '未実施',
  todo: '未実施',
  'n/a': '未実施',
  na: '未実施',
  '-': '未実施',
  '—': '未実施'
}

const key = (s: unknown): string =>
  String(s ?? '')
    .replace(/[\s\u3000]/g, '')
    .toLowerCase()

export const normalizeResult = (v: unknown): Result => RESULT_ALIASES[key(v)] ?? '未実施'

/** 見出し行から {列番号: フィールド名}。完全一致を先に、残りを部分一致で割り当てる。 */
export function matchColumns(header: unknown[]): Map<number, string> {
  const cols = new Map<number, string>()
  const used = new Set<string>()
  const assign = (test: (h: string, a: string) => boolean): void => {
    header.forEach((cell, i) => {
      const h = key(cell)
      if (!h || cols.has(i)) return
      const f = Object.keys(ALIASES).find(
        (f) => !used.has(f) && ALIASES[f].some((a) => test(h, key(a)))
      )
      if (f) {
        cols.set(i, f)
        used.add(f)
      }
    })
  }
  assign((h, a) => h === a)
  // 部分一致は、短い別名(no, id など)が「note」「identity」に誤反応しないよう、長さで絞る。
  assign((h, a) => (/^\p{ASCII}+$/u.test(a) ? a.length >= 4 : a.length >= 2) && h.includes(a))
  return cols
}

/** 表(見出し行つき)からテストケース定義を作る。取り込めなければ Error。 */
export function casesFromRows(rows: unknown[][]): ImportedCase[] {
  const at = rows.findIndex((r) => r.some((c) => key(c)))
  if (at < 0) throw new Error('空のファイルです。')
  const cols = matchColumns(rows[at])
  const fields = new Set(cols.values())
  if (!fields.has('title') && !fields.has('id'))
    throw new Error(
      '見出し行に「項目名」や「ID」の列が見つかりません。\n認識する見出し例: ID / 項目名 / フォルダ / 分類 / 前提条件 / 手順 / 期待結果 / 判定 / 備考'
    )
  const out: ImportedCase[] = []
  for (const r of rows.slice(at + 1)) {
    const rec: Record<string, string> = {}
    cols.forEach((f, i) => (rec[f] = String(r[i] ?? '').trim()))
    if (!['id', 'title', 'precondition', 'steps', 'expected'].some((f) => rec[f])) continue // 空行
    out.push({ ...rec, result: normalizeResult(rec.result) })
  }
  if (!out.length) throw new Error('取り込めるデータ行がありませんでした。')
  return out
}

/** CSV(RFC 4180: 引用符・引用符内の改行・"" のエスケープ)を行の配列にする。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell || row.length) rows.push([...row, cell])
  return rows
}

/** UTF-8(BOM可)で読めなければ Shift-JIS として読む。 */
export function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('shift_jis').decode(bytes)
  }
}
