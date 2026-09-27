// manifest.json v3。旧版(../evidence-shot)と互換。フィールド名は変えない。

export type Result = '未実施' | 'OK' | 'NG' | '保留'
// 旧版は未実施を空文字でも保存している。読み込み時に normalize で '未実施' に揃える。

export type BannerLevel = 'ok' | 'ng' | 'warn' | 'info'

export type Block =
  | { type: 'image'; image: string; title: string; url: string }
  | { type: 'code'; label: string; lang: string; text: string }
  | { type: 'table'; label: string; header: boolean; columns: string[]; rows: string[][] }
  | { type: 'note'; text: string }
  | { type: 'expect'; expected: string; actual: string; verdict: '' | 'OK' | 'NG' }
  | { type: 'banner'; level: BannerLevel; text: string }
  | { type: 'link'; links: { label: string; url: string }[] }

export interface Entry {
  /** 再利用しない一意番号。表示・出力の連番は位置から振り直す。 */
  no: number
  time: string
  comment: string
  blocks: Block[]
}

export interface TestCase {
  id: string
  title: string
  group: string
  category: string
  precondition: string
  steps: string
  expected: string
  result: Result
  note: string
  entries: Entry[]
}

export interface Meta {
  tester?: string
  date?: string
  os?: string
  browser?: string
  build?: string
  note?: string
}

export interface Manifest {
  version: 3
  session: string
  meta: Meta
  testcases: TestCase[]
}
