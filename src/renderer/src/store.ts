import { useSyncExternalStore } from 'react'
import type { Manifest } from '../../shared/types'

function createStore<T>(init: T): { get: () => T; set: (v: T) => void; use: () => T } {
  let value = init
  const listeners = new Set<() => void>()
  const get = (): T => value
  return {
    get,
    set: (v) => {
      value = v
      listeners.forEach((l) => l())
    },
    use: () =>
      useSyncExternalStore((l) => {
        listeners.add(l)
        return () => listeners.delete(l)
      }, get)
  }
}

// 開いているセッションの manifest。正本は main にあり、ここは通知を映すだけ。
const manifestStore = createStore<Manifest | null>(null)
window.api.onManifest(manifestStore.set)
export const useManifest = manifestStore.use
export const getManifest = manifestStore.get

/** 選択中のテストケースの id。OVERVIEW は概要ページ。 */
export const OVERVIEW = '@overview'
const selStore = createStore<string>(OVERVIEW)
export const useSelection = selStore.use
export const select = selStore.set
export const getSelection = selStore.get

export interface Toast {
  msg: string
  action?: { label: string; run: () => void }
}
const toastStore = createStore<Toast | null>(null)
export const useToast = toastStore.use
let toastTimer: ReturnType<typeof setTimeout>
export function toast(t: Toast | string): void {
  toastStore.set(typeof t === 'string' ? { msg: t } : t)
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toastStore.set(null), 6000)
}
export const dismissToast = (): void => toastStore.set(null)
