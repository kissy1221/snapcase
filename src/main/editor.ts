import { app, BrowserWindow, screen } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { EditorItem } from '../shared/api'
import { nextImageName } from '../shared/ops'
import type { Shot } from './capture'
import { broadcast, sendToast, state } from './state'

export interface Pending extends Shot {
  tcId: string
  /** ホットキーで撮った場合、終わったら元のアプリへフォーカスを戻す */
  restoreFocus: boolean
}

const queue: Pending[] = []
let current: Pending | null = null
let win: BrowserWindow | null = null

async function toItem(p: Pending): Promise<EditorItem> {
  const bytes = p.bytes.buffer.slice(
    p.bytes.byteOffset,
    p.bytes.byteOffset + p.bytes.byteLength
  ) as ArrayBuffer
  const tcs = state.session?.manifest.testcases ?? []
  return {
    bytes,
    mime: p.mime,
    title: p.title,
    // Windows の URL 取得は遅いので、編集画面には取れていれば出す程度にする(保存時に必ず待つ)。
    url: await Promise.race([p.url, new Promise<string>((r) => setTimeout(() => r(''), 300))]),
    tcId: p.tcId,
    testcases: tcs.map((t) => ({ id: t.id, title: t.title })),
    remaining: queue.length
  }
}

function openWindow(): BrowserWindow {
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea
  const w = new BrowserWindow({
    x: wa.x + Math.round(wa.width * 0.05),
    y: wa.y + Math.round(wa.height * 0.05),
    width: Math.round(wa.width * 0.9),
    height: Math.round(wa.height * 0.9),
    minWidth: 720,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1e2127',
    title: '画像の編集',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: false }
  })
  w.on('ready-to-show', () => w.show())
  // 閉じる操作(×)は、待っている画像も含めて破棄する。
  w.on('closed', () => {
    win = null
    current = null
    queue.length = 0
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL'])
    w.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#editor')
  else w.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'editor' })
  return w
}

async function advance(): Promise<void> {
  const done = current
  current = queue.shift() ?? null
  if (current) {
    win?.webContents.send('editor:change', await toItem(current))
    return
  }
  const w = win
  win = null
  w?.close()
  if (done?.restoreFocus && process.platform === 'darwin') app.hide()
}

/** 編集待ちに追加する。編集画面が無ければ開く。 */
export function enqueue(items: Pending[]): void {
  queue.push(...items)
  if (current) return
  current = queue.shift() ?? null
  if (current) win = openWindow()
}

export const editorCurrent = async (): Promise<EditorItem | null> =>
  current ? toItem(current) : null

/** 画像を images/ に書き、テストケースにステップとして追加する。 */
async function persist(item: Pending, png: Buffer, tcId: string, comment: string): Promise<void> {
  const session = state.session
  if (!session) return
  const name = nextImageName(session.manifest)
  await writeFile(join(session.imageDir, name), png)
  await session.apply({
    t: 'addEntry',
    tcId,
    comment,
    blocks: [{ type: 'image', image: name, title: item.title, url: await item.url }]
  })
  broadcast()
  sendToast({ msg: `${tcId} にステップを追加しました`, undo: true })
}

/** 編集画面を開かずに、撮った画像をそのまま保存する。 */
export const saveDirect = (item: Pending): Promise<void> => persist(item, item.bytes, item.tcId, '')

export async function editorSave(r: {
  png: ArrayBuffer
  comment: string
  tcId: string
}): Promise<void> {
  if (!current) return
  await persist(current, Buffer.from(r.png), r.tcId, r.comment)
  await advance()
}

export const editorDiscard = (): Promise<void> => advance()
