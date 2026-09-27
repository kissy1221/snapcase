import type { Op } from './ops'
import type { Manifest, Result } from './types'

export type ExportFormat = 'html' | 'md' | 'pdf' | 'xlsx'

export interface Settings {
  /** 撮影のグローバルホットキー(Electron の accelerator 形式) */
  hotkey: string
  /** 撮影後に編集画面を開く。オフなら注釈・コメント無しでそのまま保存する。 */
  openEditor: boolean
  /** セッションの保存先。空なら「書類/証跡作ったったー」。 */
  dataDir: string
  /** セッションを閉じるとき・アプリを終了するときに書き出す形式 */
  exportOnClose: ExportFormat[]
}

export const DEFAULT_SETTINGS: Settings = {
  hotkey: 'Control+Alt+S',
  openEditor: true,
  dataDir: '',
  exportOnClose: []
}

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
  /** 1つ前の状態に戻す / やり直す。動かせたときだけ true。 */
  undo(): Promise<boolean>
  redo(): Promise<boolean>
  getSettings(): Promise<Settings>
  /** 一部だけ更新する。ホットキーが使えない等のときは error を返し、設定は変えない。 */
  setSettings(patch: Partial<Settings>): Promise<{ settings: Settings } | { error: string }>
  /** 保存先のフォルダを選ぶ(選ばなければ null)。 */
  chooseDataDir(): Promise<string | null>
  /** ウィンドウを常に手前に表示する(コンパクト表示用)。 */
  setPinned(pinned: boolean): void
  /** 開いているテストケース。ホットキーでの撮影先になる。 */
  setSelection(tcId: string | null): void
  /** ウィンドウ選択の一覧 / 選んだウィンドウの撮影 */
  listWindows(): Promise<WindowChoice[]>
  captureSource(id: string): Promise<void>
  /** 指定の形式で書き出す。作ったファイル名(セッションフォルダ内)を返す。 */
  exportSession(formats: ExportFormat[]): Promise<{ files: string[] } | { error: string }>
  /** セッションのフォルダを OS のファイラで開く。 */
  revealSession(): Promise<void>
  /** 画像ファイルを選んで追加する(選ばなければ何もしない)。 */
  pickImages(): Promise<void>
  /** 貼り付け・ドロップされた画像を追加する。 */
  addImages(files: { name: string; bytes: ArrayBuffer; mime: string }[]): Promise<void>
  /** CSV / Excel からテストケースを取り込む。path が無ければファイル選択を出す。選ばなければ null。 */
  importTestCases(path?: string): Promise<{ count: number } | { error: string } | null>
  /** ドロップされたファイルの実パス */
  pathForFile(file: File): string
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
