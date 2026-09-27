import { nextTcId } from '../../shared/ops'
import type { Manifest, Result } from '../../shared/types'
import { select } from './store'

export const RESULT_CLASS: Record<Result, string> = { OK: 'ok', NG: 'ng', 保留: 'hold', 未実施: '' }
export const COLOR: Record<Result, string> = {
  OK: 'var(--ok)',
  NG: 'var(--ng)',
  保留: 'var(--hold)',
  未実施: 'var(--none)'
}

/** 追加が manifest に反映されてから選択する(先に選ぶと「存在しない」と見なされ概要に戻る)。 */
export async function addTestCase(m: Manifest, group = ''): Promise<void> {
  const id = nextTcId(m)
  await window.api.apply({ t: 'addTestCase', tc: { id, title: '新しいテストケース', group } })
  select(id)
}
