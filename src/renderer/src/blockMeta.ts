import type { Block } from '../../shared/types'

export type TextBlockType = Exclude<Block['type'], 'image'>

export const BLOCK_LABEL: Record<TextBlockType, string> = {
  code: 'コード',
  table: '表',
  note: 'メモ',
  expect: '期待と実際',
  banner: 'バナー',
  link: '参照リンク'
}
export const TEXT_BLOCKS = Object.keys(BLOCK_LABEL) as TextBlockType[]
