import { nextTcId } from '../../shared/ops'
import type { Manifest, Result } from '../../shared/types'
import { getSelection, select } from './store'

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

export const HOTKEY_LABEL = /Mac/.test(navigator.platform) ? ['⌃', '⌥', 'S'] : ['Ctrl', 'Alt', 'S']

/** 撮影先。開いているテストケース、無ければ最後のもの(main の targetTestCase と同じ規則)。 */
export const targetOf = (m: Manifest): string | null =>
  m.testcases.find((t) => t.id === getSelection())?.id ?? m.testcases.at(-1)?.id ?? null

/** ドロップ・貼り付けされた画像ファイルを取り込む。画像が無ければ false。 */
export async function addImageFiles(files: FileList | File[]): Promise<boolean> {
  const imgs = [...files].filter((f) => f.type.startsWith('image/'))
  if (!imgs.length) return false
  await window.api.addImages(
    await Promise.all(
      imgs.map(async (f) => ({ name: f.name, mime: f.type, bytes: await f.arrayBuffer() }))
    )
  )
  return true
}
