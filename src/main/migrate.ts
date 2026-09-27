import { copyFileSync, existsSync, mkdirSync, renameSync } from 'fs'
import { join } from 'path'

/** 旧名称「証跡作ったったー」(パッケージ名 evidence-shot)のときの場所。 */
const LEGACY_DATA_DIR = '証跡作ったったー'
const LEGACY_APP_DIR = 'evidence-shot'
const DATA_DIR = 'Snapcase'

/**
 * 改名前のデータと設定を、新しい場所へ引き継ぐ。新しい場所に既にあるものは上書きしない。
 * 失敗しても起動は止めない(引き継げなければ、新規として始まるだけ)。
 */
export function migrateLegacy(p: { documents: string; appData: string; userData: string }): void {
  try {
    const from = join(p.documents, LEGACY_DATA_DIR)
    const to = join(p.documents, DATA_DIR)
    if (existsSync(from) && !existsSync(to)) renameSync(from, to)
  } catch {
    /* 保存先が読み取り専用など。旧フォルダはそのまま残る */
  }
  try {
    const from = join(p.appData, LEGACY_APP_DIR, 'settings.json')
    const to = join(p.userData, 'settings.json')
    if (existsSync(from) && !existsSync(to)) {
      mkdirSync(p.userData, { recursive: true })
      copyFileSync(from, to)
    }
  } catch {
    /* 同上 */
  }
}
