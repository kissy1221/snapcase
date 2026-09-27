import { execFile } from 'child_process'
import {
  BrowserWindow,
  desktopCapturer,
  type DesktopCapturerSource,
  screen,
  shell,
  systemPreferences
} from 'electron'

export interface Shot {
  bytes: Buffer
  mime: string
  title: string
  /** URL は取得に時間がかかる環境(Windows)があるため、保存時に await する。 */
  url: Promise<string>
}

import type { WindowChoice } from '../shared/api'

export class CaptureError extends Error {}

const MAC_SCREEN_SETTINGS =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'

/** macOS の「画面収録」が未許可なら、設定を開いて案内する。 */
function ensureScreenPermission(): void {
  if (process.platform !== 'darwin') return
  if (systemPreferences.getMediaAccessStatus('screen') === 'granted') return
  shell.openExternal(MAC_SCREEN_SETTINGS)
  throw new CaptureError(
    '画面収録が許可されていません。開いた設定で「Snapcase」を許可し、アプリを再起動してください。'
  )
}

/** Windows のアドレスバーを UI Automation(PowerShell)で読む。取れなければ空。 */
function windowsUrl(hwnd: number): Promise<string> {
  const script = `
Add-Type -AssemblyName UIAutomationClient
$el=[System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]${Math.trunc(hwnd)})
$c=New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)
foreach($e in $el.FindAll('Descendants',$c)){try{$v=$e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value;if($v -match '^(https?://|[\\w-]+\\.[\\w-]{2,})'){$v;break}}catch{}}`
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 4000, windowsHide: true },
      (err, out) => resolve(err ? '' : out.trim())
    )
  })
}

/** desktopCapturer の source.id("window:<番号>:0")から番号を取り出す。 */
const sourceNumber = (id: string): number => Number(id.split(':')[1])

const ownWindowSourceIds = (): Set<string> =>
  new Set(BrowserWindow.getAllWindows().map((w) => w.getMediaSourceId()))

/** 番号が windowNumber のウィンドウを、実寸(物理ピクセル)で撮る。 */
async function grab(
  windowNumber: number,
  b: { x: number; y: number; width: number; height: number }
): Promise<DesktopCapturerSource> {
  const sf = screen.getDisplayNearestPoint({ x: b.x, y: b.y }).scaleFactor
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: {
      width: Math.max(1, Math.round(b.width * sf)),
      height: Math.max(1, Math.round(b.height * sf))
    }
  })
  const src = sources.find((s) => sourceNumber(s.id) === windowNumber)
  if (!src || src.thumbnail.isEmpty()) throw new CaptureError('ウィンドウを撮影できませんでした。')
  return src
}

/** 最前面のウィンドウを撮る。自分のウィンドウが最前面なら撮らずに案内する。 */
export async function captureForeground(): Promise<Shot> {
  ensureScreenPermission()
  const { activeWindow } = await import('get-windows')
  const win = await activeWindow()
  if (!win) throw new CaptureError('最前面のウィンドウを取得できませんでした。')
  if (win.owner.processId === process.pid)
    throw new CaptureError(
      'このアプリ自身が最前面です。撮りたいウィンドウを前面にしてからキーを押してください。'
    )

  const src = await grab(win.id, win.bounds)
  const url =
    process.platform === 'darwin'
      ? Promise.resolve('url' in win ? (win.url ?? '') : '')
      : process.platform === 'win32'
        ? windowsUrl(win.id)
        : Promise.resolve('')
  return { bytes: src.thumbnail.toPNG(), mime: 'image/png', title: win.title, url }
}

/** ウィンドウ選択に出す一覧(自分のウィンドウは除く)。 */
export async function listWindows(): Promise<WindowChoice[]> {
  ensureScreenPermission()
  const own = ownWindowSourceIds()
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 480, height: 320 }
  })
  return sources
    .filter((s) => !own.has(s.id) && !s.thumbnail.isEmpty())
    .map((s) => ({
      id: s.id,
      name: s.name,
      thumb: s.thumbnail.toDataURL(),
      screen: s.id.startsWith('screen:')
    }))
}

/** 選んだウィンドウ・画面を実寸で撮る。 */
export async function captureSource(id: string): Promise<Shot> {
  ensureScreenPermission()
  if (id.startsWith('screen:')) {
    const all = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1, height: 1 }
    })
    const displayId = all.find((s) => s.id === id)?.display_id
    const d =
      screen.getAllDisplays().find((x) => String(x.id) === displayId) ?? screen.getPrimaryDisplay()
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: d.size.width * d.scaleFactor, height: d.size.height * d.scaleFactor }
    })
    const src = sources.find((s) => s.id === id)
    if (!src || src.thumbnail.isEmpty()) throw new CaptureError('画面を撮影できませんでした。')
    return {
      bytes: src.thumbnail.toPNG(),
      mime: 'image/png',
      title: src.name,
      url: Promise.resolve('')
    }
  }
  const { openWindows } = await import('get-windows')
  const win = (await openWindows()).find((w) => w.id === sourceNumber(id))
  if (!win) throw new CaptureError('選んだウィンドウが見つかりません。')
  const src = await grab(win.id, win.bounds)
  return {
    bytes: src.thumbnail.toPNG(),
    mime: 'image/png',
    title: win.title || src.name,
    url: Promise.resolve('')
  }
}
