import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
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
import { listSessions, Session } from './session'
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

/** ホットキーを登録し直す。登録できなければ元に戻して false。 */
function registerHotkey(next: string): boolean {
  const prev = registered
  if (prev) globalShortcut.unregister(prev)
  let ok = false
  try {
    ok = globalShortcut.register(next, () => void captureHotkey())
  } catch {
    ok = false
  }
  if (!ok && prev) globalShortcut.register(prev, () => void captureHotkey())
  if (ok) registered = next
  return ok
}
let registered = ''

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
  registerHotkey(getSettings().hotkey)

  ipcMain.handle('sessions:list', () => listSessions(root()))
  ipcMain.handle('session:open', async (_e, name: string) => {
    state.session = await Session.open(root(), name)
    const opened = state.session
    opened.onSaved = () => scheduleLiveOutputs(opened)
    state.selectedTc = null
    broadcast()
    return state.session.manifest
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
    if (patch.hotkey && patch.hotkey !== registered && !registerHotkey(patch.hotkey))
      return { error: `${patch.hotkey} は他のアプリが使っているため登録できませんでした。` }
    return { settings: saveSettings(patch) }
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
