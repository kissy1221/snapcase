import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import type { Op } from '../shared/ops'
import { listSessions, Session } from './session'

// 保存先の変更は設定画面を作るときに対応する。
const root = (): string => join(app.getPath('documents'), '証跡作ったったー')

let current: Session | null = null

const broadcast = (): void => {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send('manifest', current?.manifest ?? null)
}

export function registerIpc(): void {
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
