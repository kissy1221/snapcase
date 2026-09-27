import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { exportOnClose, registerIpc, unregisterShortcuts } from './ipc'
import { migrateLegacy } from './migrate'
import { state } from './state'
import icon from '../../resources/icon.png?asset'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 320,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    // 独自のタイトルバー(renderer 側の .titlebar)を使う。Windows は操作ボタンだけ重ねる。
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    ...(process.platform === 'win32'
      ? { titleBarOverlay: { color: '#f3f4f6', symbolColor: '#1c2230', height: 44 } }
      : {}),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  state.mainWindow = mainWindow
  mainWindow.on('closed', () => (state.mainWindow = null))
  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    // 利用者が入力したリンクを開くので、http(s) と mailto 以外(file: など)は開かない。
    if (/^(https?|mailto):/i.test(details.url)) shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('jp.snapcase.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 改名前(証跡作ったったー)のセッションと設定を引き継ぐ。自動テスト(SNAPCASE_DATA_DIR 指定時)は実データに触れない。
  if (!process.env.SNAPCASE_DATA_DIR)
    migrateLegacy({
      documents: app.getPath('documents'),
      appData: app.getPath('appData'),
      userData: app.getPath('userData')
    })

  registerIpc()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
// アプリを終了するときも、開いているセッションを(設定があれば)書き出してから終わる。
let quitting = false
app.on('before-quit', (e) => {
  if (quitting) return
  e.preventDefault()
  quitting = true
  exportOnClose().finally(() => app.quit())
})
app.on('will-quit', unregisterShortcuts)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
