import { useSyncExternalStore } from 'react'
import type { Manifest } from '../../shared/types'

// 開いているセッションの manifest。正本は main にあり、ここは通知を映すだけ。
let manifest: Manifest | null = null
const listeners = new Set<() => void>()

window.api.onManifest((m) => {
  manifest = m
  listeners.forEach((l) => l())
})

export const useManifest = (): Manifest | null =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => manifest
  )
