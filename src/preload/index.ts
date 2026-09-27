import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { Api } from '../shared/api'

/** main → renderer の通知を購読し、解除関数を返す。 */
const on = <T>(channel: string, cb: (v: T) => void): (() => void) => {
  const h = (_: unknown, v: T): void => cb(v)
  ipcRenderer.on(channel, h)
  return () => ipcRenderer.removeListener(channel, h)
}

const api: Api = {
  listSessions: () => ipcRenderer.invoke('sessions:list'),
  openSession: (name) => ipcRenderer.invoke('session:open', name),
  closeSession: () => ipcRenderer.invoke('session:close'),
  apply: (op) => ipcRenderer.invoke('session:apply', op),
  setSelection: (id) => ipcRenderer.send('selection', id),
  listWindows: () => ipcRenderer.invoke('capture:list'),
  captureSource: (id) => ipcRenderer.invoke('capture:source', id),
  pickImages: () => ipcRenderer.invoke('images:pick'),
  addImages: (files) => ipcRenderer.invoke('images:add', files),
  importTestCases: (path) => ipcRenderer.invoke('testcases:import', path),
  pathForFile: (file) => webUtils.getPathForFile(file),
  onToast: (cb) => on('toast', cb),
  editor: {
    current: () => ipcRenderer.invoke('editor:current'),
    save: (r) => ipcRenderer.invoke('editor:save', r),
    discard: () => ipcRenderer.invoke('editor:discard'),
    onChange: (cb) => on('editor:change', cb)
  },
  onManifest: (cb) => on('manifest', cb)
}

contextBridge.exposeInMainWorld('api', api)
