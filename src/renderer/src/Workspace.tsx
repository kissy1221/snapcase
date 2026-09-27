import { useEffect, useMemo, useState } from 'react'
import { orderedGroups } from '../../shared/ops'
import type { Manifest } from '../../shared/types'
import { Shutter, WindowPicker } from './Capture'
import Compact from './Compact'
import ExportDialog from './Export'
import {
  addImageFiles,
  addTestCase,
  dropFiles,
  importTestCases,
  targetOf,
  useCompact
} from './helpers'
import Overview from './Overview'
import Palette, { type Command } from './Palette'
import SettingsDialog from './Settings'
import Sidebar from './Sidebar'
import { OVERVIEW, select, useSelection } from './store'
import TestCasePage from './TestCasePage'
import { Toaster } from './ui'
import './assets/workspace.css'

type Overlay = 'palette' | 'export' | 'settings' | 'picker' | null

export default function Workspace({ m }: { m: Manifest }): React.JSX.Element {
  const sel = useSelection()
  const compact = useCompact()
  const [overlay, setOverlay] = useState<Overlay>(null)
  const tc = m.testcases.find((t) => t.id === sel)
  const target = targetOf(m)

  // 選択中のテストケースが消えた(削除・取り消し)ときは概要に戻す。
  useEffect(() => {
    if (sel !== OVERVIEW && !tc) select(OVERVIEW)
  }, [sel, tc])

  // 画像の貼り付け(⌘V / Ctrl+V)と ⌘K。テキスト入力中の貼り付けは邪魔しない。
  useEffect(() => {
    const paste = (e: ClipboardEvent): void => {
      if ((e.target as HTMLElement).matches('input, textarea')) return
      if (e.clipboardData?.files.length) {
        e.preventDefault()
        addImageFiles(e.clipboardData.files)
      }
    }
    const key = (e: KeyboardEvent): void => {
      // 元に戻す / やり直す。入力中(その欄の取り消し)とダイアログ表示中は邪魔しない。
      const typing = (e.target as HTMLElement).matches('input, textarea, select')
      const k = e.key.toLowerCase()
      if (
        (e.metaKey || e.ctrlKey) &&
        (k === 'z' || k === 'y') &&
        !typing &&
        !document.querySelector('dialog[open]')
      ) {
        e.preventDefault()
        void (k === 'y' || e.shiftKey ? window.api.redo() : window.api.undo())
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // 別のダイアログを開いているときは、パレットで上書きしない(パレット自身は閉じられる)。
        if (document.querySelector('dialog[open]:not(:has(.palette-input))')) return
        e.preventDefault()
        setOverlay((o) => (o === 'palette' ? null : 'palette'))
      }
    }
    window.addEventListener('paste', paste)
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('paste', paste)
      window.removeEventListener('keydown', key)
    }
  }, [])

  const commands: Command[] = useMemo(() => {
    const cur = m.testcases.find((t) => t.id === sel)
    const list: Command[] = [
      { id: 'add', label: 'テストケースを追加', run: () => addTestCase(m) },
      { id: 'shoot', label: '撮影するウィンドウを選ぶ', run: () => setOverlay('picker') },
      { id: 'img', label: '画像ファイルを追加', run: () => window.api.pickImages() },
      { id: 'undo', label: '元に戻す', run: () => void window.api.undo() },
      { id: 'redo', label: 'やり直す', run: () => void window.api.redo() },
      {
        id: 'undolast',
        label: '直前の撮影を取り消す',
        run: () => window.api.apply({ t: 'undoLast' })
      },
      {
        id: 'import',
        label: 'CSV / Excel からテストケースを取り込む',
        run: () => importTestCases()
      },
      { id: 'export', label: '書き出す', run: () => setOverlay('export') },
      { id: 'overview', label: '概要と実施情報を開く', run: () => select(OVERVIEW) },
      { id: 'settings', label: '設定', run: () => setOverlay('settings') },
      { id: 'home', label: 'ホームへ戻る', run: () => window.api.closeSession() }
    ]
    if (cur)
      for (const r of ['OK', 'NG', '保留', '未実施'] as const)
        list.push({
          id: 'r' + r,
          label: `判定を ${r} にする（${cur.id}）`,
          run: () => window.api.apply({ t: 'updateTestCase', id: cur.id, patch: { result: r } })
        })
    for (const g of orderedGroups(m))
      for (const i of g.indexes) {
        const t = m.testcases[i]
        list.push({
          id: 'tc' + t.id,
          label: `${t.id} ${t.title}（${g.name}）`,
          run: () => select(t.id)
        })
      }
    return list
  }, [m, sel])

  const close = (): void => setOverlay(null)
  const overlays = (
    <>
      {overlay === 'palette' && <Palette commands={commands} onClose={close} />}
      {overlay === 'export' && <ExportDialog onClose={close} />}
      {overlay === 'settings' && <SettingsDialog onClose={close} />}
      {overlay === 'picker' && <WindowPicker onClose={close} />}
      <Toaster />
    </>
  )

  if (compact)
    return (
      <>
        <Compact m={m} tcId={target} onShoot={() => setOverlay('picker')} />
        {overlays}
      </>
    )

  return (
    <div className="ws">
      <header className="titlebar">
        <button className="session" onClick={() => window.api.closeSession()} title="ホームへ戻る">
          <span aria-hidden>‹</span> {m.session}
        </button>
        <button className="search" onClick={() => setOverlay('palette')}>
          <span>テストケースや操作を検索</span>
          <span className="kbd">
            <b>{/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'}</b>
            <b>K</b>
          </span>
        </button>
        <button className="export" onClick={() => setOverlay('export')}>
          書き出す
        </button>
        <button className="export gear" aria-label="設定" onClick={() => setOverlay('settings')}>
          設定
        </button>
      </header>
      <Sidebar m={m} />
      <main
        className="main"
        onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return
          e.preventDefault()
          dropFiles(e.dataTransfer.files)
        }}
      >
        {tc ? <TestCasePage key={tc.id} m={m} tc={tc} /> : <Overview m={m} />}
        <Shutter m={m} target={target} onPick={() => setOverlay('picker')} />
      </main>
      {overlays}
    </div>
  )
}
