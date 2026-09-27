import { BrowserWindow } from 'electron'
import type { ToastEvent } from '../shared/api'
import type { Session } from './session'

/** main プロセスが持つ現在の状態。ipc.ts と editor.ts が共有する。 */
export const state: {
  session: Session | null
  /** renderer が開いているテストケース(ホットキーでの撮影先) */
  selectedTc: string | null
  mainWindow: BrowserWindow | null
} = { session: null, selectedTc: null, mainWindow: null }

export const broadcast = (): void => {
  for (const w of BrowserWindow.getAllWindows())
    w.webContents.send('manifest', state.session?.manifest ?? null)
}

export const sendToast = (t: ToastEvent): void => {
  state.mainWindow?.webContents.send('toast', t)
}

/** 撮影先のテストケース。開いているもの、無ければ最後のもの。 */
export function targetTestCase(): string | null {
  const tcs = state.session?.manifest.testcases ?? []
  return tcs.find((t) => t.id === state.selectedTc)?.id ?? tcs.at(-1)?.id ?? null
}
