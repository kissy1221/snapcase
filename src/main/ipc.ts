import { app, BrowserWindow, ipcMain, net, protocol } from 'electron'
import { basename, join } from 'path'
import { pathToFileURL } from 'url'
import type { Op } from '../shared/ops'
import { listSessions, Session } from './session'

// 保存先の変更は設定画面を作るときに対応する。
// EVIDENCE_DATA_DIR は自動テスト用。実データを汚さないために保存先を差し替える。
const root = (): string =>
  process.env.EVIDENCE_DATA_DIR ?? join(app.getPath('documents'), '証跡作ったったー')

let current: Session | null = null

const broadcast = (): void => {
  for (const w of BrowserWindow.getAllWindows())
    w.webContents.send('manifest', current?.manifest ?? null)
}

// 画像は evidence://img/<ファイル名> で renderer に渡す(file:// を許可せずに済む)。
protocol.registerSchemesAsPrivileged([
  { scheme: 'evidence', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

export function registerIpc(): void {
  protocol.handle('evidence', (req) => {
    const name = basename(decodeURIComponent(new URL(req.url).pathname)) // basename で ../ を除く
    if (!current || !name) return new Response(null, { status: 404 })
    return net.fetch(pathToFileURL(join(current.imageDir, name)).toString())
  })
  ipcMain.handle('sessions:list', () => listSessions(root()))
  ipcMain.handle('session:open', async (_e, name: string) => {
    current = await Session.open(root(), name)
    broadcast()
    return current.manifest
  })
  ipcMain.handle('session:close', () => {
    current = null
    broadcast()
  })
  ipcMain.handle('session:apply', async (_e, op: Op) => {
    if (!current) return
    await current.apply(op)
    broadcast()
  })
}
