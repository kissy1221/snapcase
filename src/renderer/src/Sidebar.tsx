import { useState } from 'react'
import { GROUP_NONE, RESULTS } from '../../shared/constants'
import { orderedGroups } from '../../shared/ops'
import type { Manifest } from '../../shared/types'
import { COLOR, RESULT_CLASS, addTestCase, importTestCases } from './helpers'
import { OVERVIEW, select, useSelection } from './store'

export default function Sidebar({ m }: { m: Manifest }): React.JSX.Element {
  const sel = useSelection()
  const [over, setOver] = useState<string | null>(null) // ドロップ位置の強調
  const groups = orderedGroups(m)
  const counts = RESULTS.map((r) => [r, m.testcases.filter((t) => t.result === r).length] as const)

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
          return (
            <div className="folder" key={name}>
              <div
                tabIndex={0}
                className={'folder-head' + (over === '@g' + name ? ' drop' : '')}
                draggable
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
                {name}
                <span className="count num">
                  {done} / {tcs.length}
                </span>
              </div>
              {tcs.map((tc) => (
                <button
                  key={tc.id}
                  className={'tc' + (sel === tc.id ? ' sel' : '') + (over === tc.id ? ' drop' : '')}
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
                    const entry = Number(e.dataTransfer.getData('text/entry'))
                    if (entry) {
                      // 証跡を、このテストケースの末尾へ移す。
                      window.api.apply({
                        t: 'moveEntryTo',
                        no: entry,
                        toTcId: tc.id,
                        beforeNo: null
                      })
                      return
                    }
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
        <button className="add" onClick={() => importTestCases()}>
          CSV / Excel から取り込む
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
