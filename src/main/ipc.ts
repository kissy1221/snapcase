import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  nativeTheme,
  net,
  Notification,
  protocol,
  shell
} from 'electron'
import { readFile } from 'fs/promises'
import { basename, join } from 'path'
import { pathToFileURL } from 'url'
import type { Op } from '../shared/ops'
import { captureForeground, CaptureError, captureSource, listWindows } from './capture'
import {
  editorCurrent,
  editorDiscard,
  editorSave,
  enqueue,
  saveDirect,
  type Pending
} from './editor'
import { getSettings, saveSettings } from './settings'
import type { ExportFormat, Settings } from '../shared/api'
import { exportSession, scheduleLiveOutputs } from './export'
import { loadTestCases } from './import'
import { duplicateSession, listSessions, renameSession, Session } from './session'
import { broadcast, sendToast, state, targetTestCase } from './state'

// SNAPCASE_DATA_DIR は自動テスト用。実データを汚さないために保存先を差し替える。
const root = (): string =>
  process.env.SNAPCASE_DATA_DIR ||
  getSettings().dataDir ||
  join(app.getPath('documents'), 'Snapcase')

// 画像は evidence://img/<ファイル名> で renderer に渡す(file:// を許可せずに済む)。
protocol.registerSchemesAsPrivileged([
  { scheme: 'evidence', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

/** 撮った画像を、設定に応じて「編集画面へ」か「そのまま保存」に振り分ける。 */
const takeShot = (p: Pending): Promise<void> | void =>
  getSettings().openEditor ? enqueue([p]) : saveDirect(p)

type HotkeyId = 'hotkey' | 'OK' | 'NG' | '保留'
const hotkeyAction: Record<HotkeyId, () => void> = {
  hotkey: () => void captureHotkey(),
  OK: () => void verdictHotkey('OK'),
  NG: () => void verdictHotkey('NG'),
  保留: () => void verdictHotkey('保留')
}
const registered: Partial<Record<HotkeyId, string>> = {}

/** ホットキーを登録し直す。登録できなければ元に戻して false。 */
function registerHotkey(id: HotkeyId, next: string): boolean {
  const prev = registered[id]
  if (prev) globalShortcut.unregister(prev)
  let ok = false
  try {
    ok = globalShortcut.register(next, hotkeyAction[id])
  } catch {
    ok = false
  }
  if (!ok && prev) globalShortcut.register(prev, hotkeyAction[id])
  if (ok) registered[id] = next
  return ok
}

function notify(body: string): void {
  sendToast({ msg: body })
  if (!state.mainWindow?.isFocused()) new Notification({ title: 'Snapcase', body }).show()
}

/** 撮影の入口(ホットキー)。撮って、編集待ちに入れる。 */
async function captureHotkey(): Promise<void> {
  const tcId = targetTestCase()
  if (!state.session || !tcId) {
    state.mainWindow?.show()
    return notify(
      state.session ? '先にテストケースを追加してください。' : '先にセッションを開いてください。'
    )
  }
  try {
    await takeShot({ ...(await captureForeground()), tcId, restoreFocus: true })
  } catch (e) {
    notify(e instanceof CaptureError ? e.message : '撮影に失敗しました。')
  }
}

/** 判定の入口(ホットキー)。開いているテストケースに OK / NG / 保留 を付ける。 */
async function verdictHotkey(result: 'OK' | 'NG' | '保留'): Promise<void> {
  const tcId = targetTestCase()
  if (!state.session || !tcId) {
    state.mainWindow?.show()
    return notify(
      state.session ? '先にテストケースを追加してください。' : '先にセッションを開いてください。'
    )
  }
  await state.session.apply({ t: 'updateTestCase', id: tcId, patch: { result } })
  broadcast()
  const title = state.session.manifest.testcases.find((t) => t.id === tcId)?.title ?? tcId
  notify(`${title} を「${result}」にしました`)
}

const extOk = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'webp', 'tif', 'tiff']
const mimeOf = (name: string): string => {
  const e = name.split('.').pop()?.toLowerCase() ?? ''
  return e === 'jpg' ? 'image/jpeg' : e === 'tif' ? 'image/tiff' : `image/${e}`
}

export function registerIpc(): void {
  protocol.handle('evidence', (req) => {
    const name = basename(decodeURIComponent(new URL(req.url).pathname)) // basename で ../ を除く
    if (!state.session || !name) return new Response(null, { status: 404 })
    return net.fetch(pathToFileURL(join(state.session.imageDir, name)).toString())
  })
  registerHotkey('hotkey', getSettings().hotkey)
  const vh = getSettings().verdictHotkeys
  for (const r of ['OK', 'NG', '保留'] as const) registerHotkey(r, vh[r])

  ipcMain.handle('sessions:list', () => listSessions(root()))
  ipcMain.handle('session:open', async (_e, name: string) => {
    state.session = await Session.open(root(), name)
    const opened = state.session
    opened.onSaved = () => scheduleLiveOutputs(opened)
    state.selectedTc = null
    broadcast()
    return state.session.manifest
  })
  ipcMain.handle('session:rename', async (_e, from: string, to: string) => {
    // Home はセッションを閉じているときしか出ないが、念のため開いているものは対象から外す。
    if (state.session && basename(state.session.dir) === from)
      return { error: '開いているセッションは操作できません' }
    try {
      return await renameSession(root(), from, to)
    } catch (e) {
      return { error: e instanceof Error ? e.message : '名前を変更できませんでした' }
    }
  })
  ipcMain.handle('session:delete', async (_e, name: string) => {
    if (state.session && basename(state.session.dir) === name)
      return { error: '開いているセッションは操作できません' }
    try {
      await shell.trashItem(join(root(), name))
      return undefined
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'ごみ箱に移動できませんでした' }
    }
  })
  ipcMain.handle('session:duplicate', async (_e, sourceName: string, newName: string) => {
    try {
      state.session = await duplicateSession(root(), sourceName, newName)
      const opened = state.session
      opened.onSaved = () => scheduleLiveOutputs(opened)
      state.selectedTc = null
      broadcast()
      return { manifest: state.session.manifest }
    } catch (e) {
      return { error: e instanceof Error ? e.message : '複製できませんでした。' }
    }
  })
  ipcMain.handle('session:close', async () => {
    await exportOnClose()
    await state.session?.collectGarbage()
    state.session = null
    state.selectedTc = null
    broadcast()
  })
  ipcMain.handle('session:apply', async (_e, op: Op) => {
    if (!state.session) return
    await state.session.apply(op)
    broadcast()
  })
  ipcMain.handle('session:undo', async () => {
    const ok = (await state.session?.undo()) ?? false
    if (ok) broadcast()
    return ok
  })
  ipcMain.handle('session:redo', async () => {
    const ok = (await state.session?.redo()) ?? false
    if (ok) broadcast()
    return ok
  })
  ipcMain.on('selection', (_e, id: string | null) => (state.selectedTc = id))

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => {
    if (
      patch.hotkey &&
      patch.hotkey !== registered.hotkey &&
      !registerHotkey('hotkey', patch.hotkey)
    )
      return { error: `${patch.hotkey} は他のアプリが使っているため登録できませんでした。` }
    if (patch.verdictHotkeys) {
      for (const r of ['OK', 'NG', '保留'] as const) {
        const next = patch.verdictHotkeys[r]
        if (next && next !== registered[r] && !registerHotkey(r, next))
          return { error: `${next} は他のアプリが使っているため登録できませんでした。` }
      }
    }
    const before = getSettings()
    const settings = saveSettings(patch)
    if (patch.theme) nativeTheme.themeSource = patch.theme
    // 度合いのスライダーは動かすたびに呼ばれるので、0⇔それ以外をまたいだとき(鏡面の有無自体が変わるとき)
    // だけ切り替える。setVibrancy(null) → 即再設定は稀に描画プロセスを落とすことがあったため、
    // 実際に有無が変わるとき以外は触らない。
    if (
      process.platform === 'darwin' &&
      patch.glass !== undefined &&
      before.glass > 0 !== settings.glass > 0
    )
      state.mainWindow?.setVibrancy(settings.glass > 0 ? 'sidebar' : null)
    return { settings }
  })
  ipcMain.handle('settings:dataDir', async () => {
    const r = await dialog.showOpenDialog(state.mainWindow ?? BrowserWindow.getAllWindows()[0], {
      properties: ['openDirectory', 'createDirectory']
    })
    return r.canceled ? null : r.filePaths[0]
  })
  ipcMain.on('window:pin', (_e, pinned: boolean) =>
    state.mainWindow?.setAlwaysOnTop(pinned, 'floating')
  )

  ipcMain.handle('capture:list', () => listWindows())
  ipcMain.handle('capture:source', async (_e, id: string) => {
    const tcId = targetTestCase()
    if (!tcId) return
    try {
      await takeShot({ ...(await captureSource(id)), tcId, restoreFocus: false })
    } catch (e) {
      notify(e instanceof CaptureError ? e.message : '撮影に失敗しました。')
    }
  })

  ipcMain.handle('images:pick', async () => {
    const tcId = targetTestCase()
    if (!tcId) return
    const r = await dialog.showOpenDialog(state.mainWindow ?? BrowserWindow.getAllWindows()[0], {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '画像', extensions: extOk }]
    })
    const items = await Promise.all(
      r.filePaths.map(async (p) => ({
        bytes: await readFile(p),
        mime: mimeOf(p),
        title: `（取り込み）${basename(p)}`,
        url: Promise.resolve(''),
        tcId,
        restoreFocus: false
      }))
    )
    enqueue(items)
  })
  ipcMain.handle(
    'images:add',
    (_e, files: { name: string; bytes: ArrayBuffer; mime: string }[]) => {
      const tcId = targetTestCase()
      if (!tcId) return
      enqueue(
        files.map((f) => ({
          bytes: Buffer.from(f.bytes),
          mime: f.mime,
          title: `（取り込み）${f.name}`,
          url: Promise.resolve(''),
          tcId,
          restoreFocus: false
        }))
      )
    }
  )

  ipcMain.handle('session:export', async (_e, formats: ExportFormat[]) => {
    if (!state.session) return { error: '先にセッションを開いてください。' }
    try {
      return { files: await exportSession(state.session, formats) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : '書き出せませんでした。' }
    }
  })
  ipcMain.handle('session:reveal', () => state.session && shell.openPath(state.session.dir))

  ipcMain.handle('testcases:import', async (_e, path?: string) => {
    if (!state.session) return { error: '先にセッションを開いてください。' }
    if (!path) {
      const r = await dialog.showOpenDialog(state.mainWindow ?? BrowserWindow.getAllWindows()[0], {
        properties: ['openFile'],
        filters: [{ name: 'テスト仕様（CSV / Excel）', extensions: ['csv', 'xlsx', 'xlsm'] }]
      })
      if (r.canceled || !r.filePaths[0]) return null
      path = r.filePaths[0]
    }
    try {
      const tcs = await loadTestCases(path)
      await state.session.apply({ t: 'addTestCases', tcs })
      broadcast()
      return { count: tcs.length }
    } catch (e) {
      return { error: e instanceof Error ? e.message : '取り込めませんでした。' }
    }
  })

  ipcMain.handle('editor:current', () => editorCurrent())
  ipcMain.handle('editor:save', (_e, r) => editorSave(r))
  ipcMain.handle('editor:discard', () => editorDiscard())
}

export const unregisterShortcuts = (): void => globalShortcut.unregisterAll()

/** 「閉じるときに書き出す」の設定があれば、開いているセッションを書き出す。 */
export async function exportOnClose(): Promise<void> {
  const formats = getSettings().exportOnClose
  const s = state.session
  if (!s || !formats.length || !s.manifest.testcases.some((t) => t.entries.length)) return
  try {
    const files = await exportSession(s, formats)
    new Notification({
      title: 'Snapcase',
      body: `${files.join('、')} を書き出しました`
    }).show()
  } catch {
    new Notification({
      title: 'Snapcase',
      body: '書き出しに失敗しました。手動で書き出してください。'
    }).show()
  }
}
