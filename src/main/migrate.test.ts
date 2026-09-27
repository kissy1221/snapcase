import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { expect, it } from 'vitest'
import { migrateLegacy } from './migrate'

const dirs = (): { documents: string; appData: string; userData: string } => {
  const root = mkdtempSync(join(tmpdir(), 'mig-'))
  const d = {
    documents: join(root, 'docs'),
    appData: join(root, 'appdata'),
    userData: join(root, 'appdata', 'snapcase')
  }
  mkdirSync(d.documents, { recursive: true })
  return d
}
const put = (path: string, text: string): void => {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, text)
}

it('旧フォルダのセッションと、旧設定を新しい場所へ引き継ぐ', () => {
  const d = dirs()
  put(join(d.documents, '証跡作ったったー', '会員登録', 'manifest.json'), '{"a":1}')
  put(join(d.appData, 'evidence-shot', 'settings.json'), '{"hotkey":"Control+Alt+K"}')
  migrateLegacy(d)
  expect(readFileSync(join(d.documents, 'Snapcase', '会員登録', 'manifest.json'), 'utf-8')).toBe(
    '{"a":1}'
  )
  expect(existsSync(join(d.documents, '証跡作ったったー'))).toBe(false)
  expect(readFileSync(join(d.userData, 'settings.json'), 'utf-8')).toBe(
    '{"hotkey":"Control+Alt+K"}'
  )
})

it('新しい場所に既にあるものは上書きしない(旧データも消さない)', () => {
  const d = dirs()
  put(join(d.documents, '証跡作ったったー', 'old', 'manifest.json'), 'old')
  put(join(d.documents, 'Snapcase', 'new', 'manifest.json'), 'new')
  put(join(d.appData, 'evidence-shot', 'settings.json'), 'old-settings')
  put(join(d.userData, 'settings.json'), 'new-settings')
  migrateLegacy(d)
  expect(readFileSync(join(d.documents, 'Snapcase', 'new', 'manifest.json'), 'utf-8')).toBe('new')
  expect(existsSync(join(d.documents, '証跡作ったったー', 'old', 'manifest.json'))).toBe(true)
  expect(readFileSync(join(d.userData, 'settings.json'), 'utf-8')).toBe('new-settings')
})

it('旧データが無ければ何もしない', () => {
  const d = dirs()
  migrateLegacy(d)
  expect(existsSync(join(d.documents, 'Snapcase'))).toBe(false)
  expect(existsSync(d.userData)).toBe(false)
})
