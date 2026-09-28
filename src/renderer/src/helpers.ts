import { useSyncExternalStore } from 'react'
import { nextTcId, orderedGroups } from '../../shared/ops'
import type { Manifest, Result, TestCase } from '../../shared/types'
import { OVERVIEW, confirmAsk, getManifest, getSelection, select, toast } from './store'

/** 設定の「鏡面の度合い」(0-100) を CSS 変数に反映する。0 で完全に不透明(鏡面オフ)。
 * 実際の不透明度・ブラーは main.css 側の calc() が持つ(ライト/ダークで上限を変えるため)。 */
export function applyGlass(degree: number): void {
  const d = Math.min(100, Math.max(0, degree)) / 100
  document.documentElement.style.setProperty('--glass-degree', String(d))
}

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

const platformHint = (navigator as Navigator & { userAgentData?: { platform?: string } })
  .userAgentData?.platform
export const IS_MAC = /mac/i.test(platformHint ?? navigator.platform)

const SYMBOL: Record<string, string> = {
  Control: IS_MAC ? '⌃' : 'Ctrl',
  Alt: IS_MAC ? '⌥' : 'Alt',
  Shift: IS_MAC ? '⇧' : 'Shift',
  Command: '⌘',
  Super: 'Win'
}

/** ホットキーの accelerator 文字列(例: "Control+Alt+S")を、表示用の記号の並びにする。 */
export const hotkeyParts = (acc: string): string[] => acc.split('+').map((k) => SYMBOL[k] ?? k)

/** 撮影先。開いているテストケース、無ければ最後のもの(main の targetTestCase と同じ規則)。 */
export const targetOf = (m: Manifest): string | null =>
  m.testcases.find((t) => t.id === getSelection())?.id ?? m.testcases.at(-1)?.id ?? null

/** 判定を付ける。設定がオンなら、並び順で次の未実施のテストケースを開く(無ければ移らない)。 */
export async function setResult(m: Manifest, tc: TestCase, result: Result): Promise<void> {
  await window.api.apply({ t: 'updateTestCase', id: tc.id, patch: { result } })
  const s = await window.api.getSettings()
  if (!s.autoAdvance) return
  const order = orderedGroups(m).flatMap((g) => g.indexes.map((i) => m.testcases[i]))
  const next = order
    .slice(order.findIndex((t) => t.id === tc.id) + 1)
    .find((t) => t.result === '未実施')
  if (next) select(next.id)
}

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

/** フォルダ名をまとめて変える。属する全テストケースの group を書き換え、既存フォルダと同名なら自然に統合される。 */
export async function renameGroup(from: string, to: string): Promise<void> {
  await window.api.apply({ t: 'renameGroup', from, to })
  undoToast(`「${from}」を「${to}」に変更しました`)
}

/** フォルダを削除する。属するテストケースは未分類に移すだけで、テストケース自体は消さない。 */
export async function deleteGroup(m: Manifest, name: string): Promise<void> {
  const n = orderedGroups(m).find((g) => g.name === name)?.indexes.length ?? 0
  const ok = await confirmAsk({
    title: `「${name}」を削除しますか？`,
    message: `属する${n}件のテストケースを未分類に移します。テストケース自体は削除されません。削除したあとも、⌘Z（Ctrl+Z）か「元に戻す」で戻せます。`,
    okLabel: '削除する'
  })
  if (!ok) return
  await window.api.apply({ t: 'deleteGroup', name })
  undoToast(`「${name}」を削除しました`)
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
