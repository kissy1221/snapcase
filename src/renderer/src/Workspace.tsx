import { useEffect } from 'react'
import type { Manifest } from '../../shared/types'
import { Shutter } from './Capture'
import { addImageFiles, targetOf } from './helpers'
import Overview from './Overview'
import Sidebar from './Sidebar'
import { OVERVIEW, select, useSelection } from './store'
import TestCasePage from './TestCasePage'
import { Toaster } from './ui'
import './assets/workspace.css'

export default function Workspace({ m }: { m: Manifest }): React.JSX.Element {
  const sel = useSelection()
  const tc = m.testcases.find((t) => t.id === sel)
  // 選択中のテストケースが消えた(削除・取り消し)ときは概要に戻す。
  useEffect(() => {
    if (sel !== OVERVIEW && !tc) select(OVERVIEW)
  }, [sel, tc])

  // 画像の貼り付け(⌘V / Ctrl+V)とドロップ。テキスト入力中の貼り付けは邪魔しない。
  useEffect(() => {
    const h = (e: ClipboardEvent): void => {
      if ((e.target as HTMLElement).matches('input, textarea')) return
      if (e.clipboardData?.files.length) {
        e.preventDefault()
        addImageFiles(e.clipboardData.files)
      }
    }
    window.addEventListener('paste', h)
    return () => window.removeEventListener('paste', h)
  }, [])

  return (
    <div className="ws">
      <header className="titlebar">
        <button className="session" onClick={() => window.api.closeSession()} title="ホームへ戻る">
          <span aria-hidden>‹</span> {m.session}
        </button>
      </header>
      <Sidebar m={m} />
      <main
        className="main"
        onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return
          e.preventDefault()
          addImageFiles(e.dataTransfer.files)
        }}
      >
        {tc ? <TestCasePage key={tc.id} m={m} tc={tc} /> : <Overview m={m} />}
        <Shutter m={m} target={targetOf(m)} />
        <Toaster />
      </main>
    </div>
  )
}
