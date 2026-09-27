import { useSyncExternalStore } from 'react'
import { nextTcId } from '../../shared/ops'
import type { Manifest, Result, TestCase } from '../../shared/types'
import { OVERVIEW, confirmAsk, getManifest, getSelection, select, toast } from './store'

export const RESULT_CLASS: Record<Result, string> = { OK: 'ok', NG: 'ng', 保留: 'hold', 未実施: '' }
export const COLOR: Record<Result, string> = {
  OK: 'var(--ok)',
  NG: 'var(--ng)',
  保留: 'var(--hold)',
  未実施: 'var(--none)'
}

/** 追加が manifest に反映されてから選択する(先に選ぶと「存在しない」と見なされ概要に戻る)。 */
export async function addTestCase(m: Manifest, group = '', open = true): Promise<void> {
  const id = nextTcId(m)
  await window.api.apply({ t: 'addTestCase', tc: { id, title: '新しいテストケース', group } })
  if (open) select(id)
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

const isSpec = (f: File): boolean => /\.(csv|xlsx|xlsm)$/i.test(f.name)

/** CSV / Excel からテストケースを取り込み、結果を通知する。path 無しはファイル選択。 */
export async function importTestCases(path?: string): Promise<void> {
  const r = await window.api.importTestCases(path)
  if (!r) return
  toast(
    'error' in r ? `取り込めませんでした: ${r.error}` : `${r.count}件のテストケースを取り込みました`
  )
}

/** ドロップされたファイルを、画像ならステップへ、CSV / Excel ならテストケースへ取り込む。 */
export async function dropFiles(files: FileList): Promise<void> {
  const spec = [...files].find(isSpec)
  if (spec) return importTestCases(window.api.pathForFile(spec))
  await addImageFiles(files)
}

const query = window.matchMedia('(max-width: 560px)')
/** ウィンドウを細くしたらコンパクト表示にする。 */
export const useCompact = (): boolean =>
  useSyncExternalStore(
    (cb) => {
      query.addEventListener('change', cb)
      return () => query.removeEventListener('change', cb)
    },
    () => query.matches
  )

/** 元に戻せる操作の後に出すトースト。 */
export const undoToast = (msg: string): void =>
  toast({ msg, action: { label: '元に戻す', run: () => void window.api.undo() } })

/** テストケースを削除する。確認ダイアログで了承されたときだけ実行し、あとから「元に戻す」も出す。 */
export async function deleteTestCase(id: string): Promise<void> {
  const tc = getManifest()?.testcases.find((t) => t.id === id)
  const n = tc?.entries.length ?? 0
  const ok = await confirmAsk({
    title: `${id} を削除しますか？`,
    message: `「${tc?.title ?? id}」${n ? `と、その${n}件のステップ` : ''}を削除します。削除したあとも、⌘Z（Ctrl+Z）か「元に戻す」で戻せます。`,
    okLabel: '削除する'
  })
  if (!ok) return
  select(OVERVIEW)
  void window.api.apply({ t: 'deleteTestCase', id })
  undoToast(`${id} を削除しました`)
}

/** テストケースを複製する。記録(画像)は複製せず、記載欄だけを写す。 */
export async function duplicateTestCase(m: Manifest, tc: TestCase): Promise<void> {
  const rest: Partial<TestCase> = { ...tc }
  delete rest.entries // ステップ(画像を含む)は複製しない
  const id = nextTcId(m)
  await window.api.apply({
    t: 'addTestCase',
    tc: { ...rest, id, title: `${tc.title} のコピー`, result: '未実施' }
  })
  select(id)
}
