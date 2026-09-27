import type { Result } from './types'

export const RESULTS: Result[] = ['未実施', 'OK', 'NG', '保留']

export const CATEGORIES = ['正常系', '準正常系', '準異常系', '異常系', '境界値']

/** フォルダ未設定のテストケースをまとめる見出し名。 */
export const GROUP_NONE = '（未分類）'

export const META_FIELDS = [
  ['tester', '実施者'],
  ['date', '実施日'],
  ['os', 'OS / 端末'],
  ['browser', 'ブラウザ'],
  ['build', '対象ビルド / 版数'],
  ['note', '備考']
] as const

export const BANNER_LEVELS = [
  ['ok', '期待通り'],
  ['ng', '不具合'],
  ['warn', '注意 / 既知'],
  ['info', '補足']
] as const

export const CODE_LANGS = [
  'sql',
  'json',
  'text',
  'log',
  'xml',
  'yaml',
  'python',
  'javascript',
  'shell',
  'html',
  'csv',
  'diff'
]
