import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/api'

const api: Api = {
  listSessions: () => ipcRenderer.invoke('sessions:list'),
  openSession: (name) => ipcRenderer.invoke('session:open', name),
  closeSession: () => ipcRenderer.invoke('session:close'),
  apply: (op) => ipcRenderer.invoke('session:apply', op),
  onManifest: (cb) => {
    const h = (_: unknown, m: Parameters<typeof cb>[0]): void => cb(m)
    ipcRenderer.on('manifest', h)
    return () => ipcRenderer.removeListener('manifest', h)
  }
}

contextBridge.exposeInMainWorld('api', api)
