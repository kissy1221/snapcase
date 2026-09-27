import type { Op } from './ops'
import type { Manifest, Result } from './types'

export interface SessionSummary {
  name: string
  /** manifest.json の更新時刻(ms) */
  updatedAt: number
  /** テストケース数 */
  total: number
  /** 判定ごとのテストケース数 */
  counts: Record<Result, number>
  /** 記録(証跡)の総数 */
  entries: number
}

/** preload が window.api として公開する、renderer から main への窓口。 */
export interface Api {
  listSessions(): Promise<SessionSummary[]>
  /** 無ければ作り、あれば続きから開く。 */
  openSession(name: string): Promise<Manifest>
  closeSession(): Promise<void>
  apply(op: Op): Promise<void>
  /** 開いているセッションが変わるたび(操作・取り込み・閉じる)に呼ばれる。解除関数を返す。 */
  onManifest(cb: (m: Manifest | null) => void): () => void
}
