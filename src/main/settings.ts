import { app } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_SETTINGS, type Settings } from '../shared/api'

const file = (): string => join(app.getPath('userData'), 'settings.json')

let cache: Settings | null = null

export function getSettings(): Settings {
  if (!cache) {
    try {
      cache = { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(file(), 'utf-8')) }
    } catch {
      cache = { ...DEFAULT_SETTINGS } // 無い・壊れているときは既定値
    }
  }
  return cache!
}

export function saveSettings(patch: Partial<Settings>): Settings {
  cache = { ...getSettings(), ...patch }
  writeFileSync(file(), JSON.stringify(cache, null, 2), 'utf-8')
  return cache
}
