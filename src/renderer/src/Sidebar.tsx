import { useState } from 'react'
import { GROUP_NONE, RESULTS } from '../../shared/constants'
import { orderedGroups } from '../../shared/ops'
import type { Manifest, TestCase } from '../../shared/types'
import {
  COLOR,
  RESULT_CLASS,
  addTestCase,
  deleteGroup,
  deleteTestCase,
  duplicateTestCase,
  importTestCases,
  renameGroup
} from './helpers'
import { Menu, type MenuItem } from './Menu'
import { OVERVIEW, TABLE, select, useSelection } from './store'
import { Dialog } from './ui'

/** フォルダ名を変えるダイアログ。空・変更なしなら何もしない。 */
function RenameGroupDialog({
  name,
  onClose
}: {
  name: string
  onClose: () => void
}): React.JSX.Element {
  const [next, setNext] = useState(name === GROUP_NONE ? '' : name)
  return (
    <Dialog title="フォルダ名を変更" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          const to = next.trim()
          if (to && to !== name) renameGroup(name, to)
          onClose()
        }}
      >
        <label>
          フォルダ名
          <input
            value={next}
            onChange={(e) => setNext(e.target.value)}
            aria-label="フォルダ名"
            autoFocus
          />
        </label>
        <div className="actions">
          <button type="button" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="primary" disabled={!next.trim()}>
            変更する
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export default function Sidebar({ m }: { m: Manifest }): React.JSX.Element {
  const sel = useSelection()
  const [over, setOver] = useState<string | null>(null) // ドロップ位置の強調
  const [renaming, setRenaming] = useState<string | null>(null)
  const groups = orderedGroups(m)
  const counts = RESULTS.map((r) => [r, m.testcases.filter((t) => t.result === r).length] as const)

  /** Alt+↑/↓ でキーボードからも並べ替えられる。 */
  const altMove = (e: React.KeyboardEvent, run: (d: -1 | 1) => void): void => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
    e.preventDefault()
    run(e.key === 'ArrowUp' ? -1 : 1)
  }

  const groupMenu = (name: string): MenuItem[] => [
    { label: '名前を変更', run: () => setRenaming(name) },
    { label: '削除', danger: true, disabled: name === GROUP_NONE, run: () => deleteGroup(m, name) }
  ]

  const tcMenu = (tc: TestCase, i: number, count: number, group: string): MenuItem[] => [
    { label: '複製', run: () => duplicateTestCase(m, tc) },
    {
      label: '上へ移動',
      disabled: i === 0,
      run: () => window.api.apply({ t: 'moveTestCaseBy', id: tc.id, delta: -1 })
    },
    {
      label: '下へ移動',
      disabled: i === count - 1,
      run: () => window.api.apply({ t: 'moveTestCaseBy', id: tc.id, delta: 1 })
    },
    ...(groups.length > 1
      ? [
          { label: 'フォルダへ移動', heading: true },
          ...groups
            .filter((g) => g.name !== group)
            .map((g) => ({
              label: g.name,
              run: () =>
                window.api.apply({ t: 'moveTestCase', id: tc.id, toGroup: g.name, beforeId: null })
            }))
        ]
      : []),
    { label: '', heading: true },
    { label: 'テストケースを削除', danger: true, run: () => deleteTestCase(tc.id) }
  ]

  return (
    <aside className="sidebar">
      <button className={'nav' + (sel === OVERVIEW ? ' sel' : '')} onClick={() => select(OVERVIEW)}>
        概要
      </button>
      <button className={'nav' + (sel === TABLE ? ' sel' : '')} onClick={() => select(TABLE)}>
        一覧
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
                <Menu
                  className="end"
                  label={`${name} のメニュー`}
                  trigger="⋯"
                  items={groupMenu(name)}
                />
              </div>
              {tcs.map((tc, i) => (
                <div
                  key={tc.id}
                  className="tc-row"
                  onContextMenu={(e) => {
                    e.preventDefault()
                    e.currentTarget.querySelector<HTMLButtonElement>('.menu-btn')?.click()
                  }}
                >
                  <button
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
                      const entry = Number(e.dataTransfer.getData('text/entry'))
                      if (entry) {
                        // ステップを、このテストケースの末尾へ移す。
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
                  <Menu
                    className="end"
                    label={`${tc.id} のメニュー`}
                    trigger="⋯"
                    items={tcMenu(tc, i, tcs.length, name)}
                  />
                </div>
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
      {renaming !== null && <RenameGroupDialog name={renaming} onClose={() => setRenaming(null)} />}
    </aside>
  )
}
