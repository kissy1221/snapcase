import { useEffect } from 'react'
import type { Manifest } from '../../shared/types'
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

  return (
    <div className="ws">
      <header className="titlebar">
        <button className="session" onClick={() => window.api.closeSession()} title="ホームへ戻る">
          <span aria-hidden>‹</span> {m.session}
        </button>
      </header>
      <Sidebar m={m} />
      <main className="main">
        {tc ? (
          <TestCasePage key={tc.id} m={m} tc={tc} />
        ) : (
          <div className="page">
            <h1 className="title">概要と実施情報</h1>
            <p className="empty">実装中</p>
          </div>
        )}
        <Toaster />
      </main>
    </div>
  )
}
