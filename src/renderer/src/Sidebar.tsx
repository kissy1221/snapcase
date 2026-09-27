import { useState } from 'react'
import { GROUP_NONE, RESULTS } from '../../shared/constants'
import { orderedGroups } from '../../shared/ops'
import type { Manifest } from '../../shared/types'
import { COLOR, RESULT_CLASS, addTestCase } from './helpers'
import { OVERVIEW, select, useSelection } from './store'

export default function Sidebar({ m }: { m: Manifest }): React.JSX.Element {
  const sel = useSelection()
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const [over, setOver] = useState<string | null>(null) // ドロップ位置の強調
  const groups = orderedGroups(m)
  const counts = RESULTS.map((r) => [r, m.testcases.filter((t) => t.result === r).length] as const)

  const toggle = (name: string): void =>
    setClosed((c) => {
      const n = new Set(c)
      if (!n.delete(name)) n.add(name)
      return n
    })

  /** Alt+↑/↓ でキーボードからも並べ替えられる。 */
  const altMove = (e: React.KeyboardEvent, run: (d: -1 | 1) => void): void => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    run(e.key === 'ArrowUp' ? -1 : 1)
  }

  return (
    <aside className="sidebar">
      <button className={'nav' + (sel === OVERVIEW ? ' sel' : '')} onClick={() => select(OVERVIEW)}>
        概要と実施情報
      </button>

      <nav className="tree" aria-label="テストケース">
        {groups.length === 0 && <p className="side-empty">テストケースはまだありません</p>}
        {groups.map(({ name, indexes }) => {
          const tcs = indexes.map((i) => m.testcases[i])
          const done = tcs.filter((t) => t.result !== '未実施').length
          const isClosed = closed.has(name)
          return (
            <div className="folder" key={name}>
              <button
                className={'folder-head' + (over === '@g' + name ? ' drop' : '')}
                draggable
                aria-expanded={!isClosed}
                onClick={() => toggle(name)}
                onKeyDown={(e) =>
                  altMove(e, (delta) => window.api.apply({ t: 'moveGroup', name, delta }))
                }
                onDragStart={(e) => e.dataTransfer.setData('text/group', name)}
                onDragOver={(e) => {
                  e.preventDefault()
                  setOver('@g' + name)
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  setOver(null)
                  const g = e.dataTransfer.getData('text/group')
                  const id = e.dataTransfer.getData('text/tc')
                  if (g && g !== name)
                    window.api.apply({ t: 'moveGroupTo', name: g, beforeName: name })
                  if (id) window.api.apply({ t: 'moveTestCase', id, toGroup: name, beforeId: null })
                }}
              >
                <span className="chev" aria-hidden>
                  {isClosed ? '▸' : '▾'}
                </span>
                {name}
                <span className="count num">
                  {done} / {tcs.length}
                </span>
              </button>
              {!isClosed &&
                tcs.map((tc) => (
                  <button
                    key={tc.id}
                    className={
                      'tc' + (sel === tc.id ? ' sel' : '') + (over === tc.id ? ' drop' : '')
                    }
                    draggable
                    onClick={() => select(tc.id)}
                    onKeyDown={(e) =>
                      altMove(e, (delta) =>
                        window.api.apply({ t: 'moveTestCaseBy', id: tc.id, delta })
                      )
                    }
                    onDragStart={(e) => e.dataTransfer.setData('text/tc', tc.id)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setOver(tc.id)
                    }}
                    onDragLeave={() => setOver(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setOver(null)
                      const id = e.dataTransfer.getData('text/tc')
                      if (id && id !== tc.id)
                        window.api.apply({
                          t: 'moveTestCase',
                          id,
                          toGroup: name === GROUP_NONE ? '' : name,
                          beforeId: tc.id
                        })
                    }}
                  >
                    <span className={'dot ' + RESULT_CLASS[tc.result]} title={tc.result} />
                    <span className="id num">{tc.id}</span>
                    <span className="t">{tc.title}</span>
                    <span className="n num">{tc.entries.length || ''}</span>
                  </button>
                ))}
            </div>
          )
        })}
      </nav>

      <div className="side-foot">
        <button className="add" onClick={() => addTestCase(m)}>
          ＋ テストケースを追加
        </button>
        {m.testcases.length > 0 && (
          <>
            <div
              className="bar"
              role="img"
              aria-label={counts.map(([r, n]) => `${r} ${n}`).join('、')}
            >
              {counts.map(([r, n]) => (
                <i key={r} style={{ flex: n, background: COLOR[r] }} />
              ))}
            </div>
            <div className="legend num">
              {counts.map(([r, n]) => (
                <span key={r}>
                  <span className={'dot ' + RESULT_CLASS[r]} />
                  {r} {n}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
