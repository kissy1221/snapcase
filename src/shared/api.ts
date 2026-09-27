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
  /** 開いているテストケース。ホットキーでの撮影先になる。 */
  setSelection(tcId: string | null): void
  /** ウィンドウ選択の一覧 / 選んだウィンドウの撮影 */
  listWindows(): Promise<WindowChoice[]>
  captureSource(id: string): Promise<void>
  /** 画像ファイルを選んで追加する(選ばなければ何もしない)。 */
  pickImages(): Promise<void>
  /** 貼り付け・ドロップされた画像を追加する。 */
  addImages(files: { name: string; bytes: ArrayBuffer; mime: string }[]): Promise<void>
  onToast(cb: (t: ToastEvent) => void): () => void

  /** 編集画面(別ウィンドウ)用 */
  editor: {
    /** 編集中の1枚。無ければ null。 */
    current(): Promise<EditorItem | null>
    save(r: { png: ArrayBuffer; comment: string; tcId: string }): Promise<void>
    discard(): Promise<void>
    /** 次の画像に切り替わったとき、または待ちが無くなったとき(null)に呼ばれる。 */
    onChange(cb: (item: EditorItem | null) => void): () => void
  }

  /** 開いているセッションが変わるたび(操作・取り込み・閉じる)に呼ばれる。解除関数を返す。 */
  onManifest(cb: (m: Manifest | null) => void): () => void
}

/** 編集画面が開く画像1枚ぶんの情報。 */
export interface EditorItem {
  bytes: ArrayBuffer
  mime: string
  title: string
  url: string
  /** 保存先の初期値(撮影時に開いていたテストケース) */
  tcId: string
  testcases: { id: string; title: string }[]
  /** この画像のあとに編集待ちの画像が何枚あるか */
  remaining: number
}

export interface WindowChoice {
  id: string
  name: string
  thumb: string
  screen: boolean
}

export interface ToastEvent {
  msg: string
  /** 「取り消し」ボタンを付ける(直前の記録を消す) */
  undo?: boolean
}
