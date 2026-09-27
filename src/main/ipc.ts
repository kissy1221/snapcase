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
import { editorCurrent, editorDiscard, editorSave, enqueue } from './editor'
import type { ExportFormat } from '../shared/api'
import { exportSession, scheduleLiveOutputs } from './export'
import { loadTestCases } from './import'
import { listSessions, Session } from './session'
import { broadcast, sendToast, state, targetTestCase } from './state'

// EVIDENCE_DATA_DIR は自動テスト用。実データを汚さないために保存先を差し替える。
const root = (): string =>
  process.env.EVIDENCE_DATA_DIR ?? join(app.getPath('documents'), '証跡作ったったー')

// 画像は evidence://img/<ファイル名> で renderer に渡す(file:// を許可せずに済む)。
protocol.registerSchemesAsPrivileged([
  { scheme: 'evidence', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

const HOTKEY = 'Control+Alt+S'

function notify(body: string): void {
  sendToast({ msg: body })
  if (!state.mainWindow?.isFocused()) new Notification({ title: '証跡作ったったー', body }).show()
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
    enqueue([{ ...(await captureForeground()), tcId, restoreFocus: true }])
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
  globalShortcut.register(HOTKEY, () => void captureHotkey())

  ipcMain.handle('sessions:list', () => listSessions(root()))
  ipcMain.handle('session:open', async (_e, name: string) => {
    state.session = await Session.open(root(), name)
    const opened = state.session
    opened.onSaved = () => scheduleLiveOutputs(opened)
    state.selectedTc = null
    broadcast()
    return state.session.manifest
  })
  ipcMain.handle('session:close', () => {
    state.session = null
    state.selectedTc = null
    broadcast()
  })
  ipcMain.handle('session:apply', async (_e, op: Op) => {
    if (!state.session) return
    await state.session.apply(op)
    broadcast()
  })
  ipcMain.on('selection', (_e, id: string | null) => (state.selectedTc = id))

  ipcMain.handle('capture:list', () => listWindows())
  ipcMain.handle('capture:source', async (_e, id: string) => {
    const tcId = targetTestCase()
    if (!tcId) return
    try {
      enqueue([{ ...(await captureSource(id)), tcId, restoreFocus: false }])
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
