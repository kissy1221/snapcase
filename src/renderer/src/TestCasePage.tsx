import { useState } from 'react'
import { CATEGORIES, RESULTS } from '../../shared/constants'
import { displayNumbers } from '../../shared/ops'
import type { Block, Manifest, TestCase } from '../../shared/types'
import { BLOCK_LABEL, TEXT_BLOCKS, type TextBlockType } from './blockMeta'
import { BlockDialog, BlockView, ImageViewer } from './Blocks'
import { RESULT_CLASS, undoToast } from './helpers'
import { Menu, type MenuItem } from './Menu'
import { OVERVIEW, select } from './store'
import { AutoLine, AutoText } from './ui'

type ImageBlock = Extract<Block, { type: 'image' }>
type Editing = { type: TextBlockType; no?: number; index?: number; initial?: Block }

export default function TestCasePage({ m, tc }: { m: Manifest; tc: TestCase }): React.JSX.Element {
  const [editing, setEditing] = useState<Editing | null>(null)
  const [viewing, setViewing] = useState<ImageBlock | null>(null)
  const [over, setOver] = useState<string | null>(null) // ドロップ位置の強調(直前に線を出す)
  const [dragging, setDragging] = useState<string | null>(null) // ドラッグ中の要素(薄く表示する)
  const numbers = displayNumbers(m)
  const apply = window.api.apply
  const patch = (p: Partial<TestCase>): Promise<void> =>
    apply({ t: 'updateTestCase', id: tc.id, patch: p })
  const groups = [...new Set(m.testcases.map((t) => t.group).filter(Boolean))]
  const others = m.testcases.filter((t) => t.id !== tc.id)
  const lastEntry = tc.entries.length - 1

  const submit = (b: Block): void => {
    if (!editing) return
    if (editing.no === undefined) apply({ t: 'addEntry', tcId: tc.id, blocks: [b] })
    else if (editing.index === undefined)
      apply({ t: 'addBlock', tcId: tc.id, no: editing.no, block: b })
    else apply({ t: 'updateBlock', tcId: tc.id, no: editing.no, index: editing.index, block: b })
    setEditing(null)
  }

  /** 削除はすぐ実行し、「元に戻す」を出す(確認ダイアログは出さない)。 */
  const removeTc = (): void => {
    select(OVERVIEW)
    apply({ t: 'deleteTestCase', id: tc.id })
    undoToast(`${tc.id} を削除しました`)
  }

  /** ドラッグ中の種類が合うときだけ、ドロップを受けて位置を強調する。 */
  const hover = (ev: React.DragEvent, key: string, accepts: string[]): void => {
    if (!accepts.some((t) => ev.dataTransfer.types.includes(t))) return
    ev.preventDefault()
    ev.stopPropagation()
    setOver(key)
  }
  const dropEntry = (ev: React.DragEvent, beforeNo: number | null): void => {
    const no = Number(ev.dataTransfer.getData('text/entry'))
    if (!no) return
    ev.preventDefault()
    ev.stopPropagation()
    setOver(null)
    apply({ t: 'moveEntryTo', no, toTcId: tc.id, beforeNo })
  }
  const dropBlock = (ev: React.DragEvent, src: string, toNo: number, toIndex: number): void => {
    ev.preventDefault()
    ev.stopPropagation()
    setOver(null)
    const [no, index] = src.split(':').map(Number)
    apply({ t: 'moveBlockTo', no, index, toNo, toIndex })
  }

  const entryMenu = (no: number, i: number): MenuItem[] => [
    {
      label: '上へ移動',
      disabled: i === 0,
      run: () => apply({ t: 'moveEntry', tcId: tc.id, no, delta: -1 })
    },
    {
      label: '下へ移動',
      disabled: i === lastEntry,
      run: () => apply({ t: 'moveEntry', tcId: tc.id, no, delta: 1 })
    },
    ...(others.length
      ? [
          { label: '別のテストケースへ移動', heading: true },
          ...others.map((o) => ({
            label: `${o.id}  ${o.title}`,
            run: () => {
              apply({ t: 'moveEntryTo', no, toTcId: o.id, beforeNo: null })
              undoToast(`${o.id} へ移動しました`)
            }
          }))
        ]
      : []),
    { label: '', heading: true },
    {
      label: 'この証跡を削除',
      danger: true,
      run: () => {
        apply({ t: 'deleteEntry', tcId: tc.id, no })
        undoToast('証跡を削除しました')
      }
    }
  ]

  const blockMenu = (no: number, i: number, j: number, b: Block, count: number): MenuItem[] => [
    b.type === 'image'
      ? { label: '拡大して見る', run: () => setViewing(b) }
      : {
          label: '編集',
          run: () => setEditing({ type: b.type as TextBlockType, no, index: j, initial: b })
        },
    {
      label: '上へ移動',
      disabled: i === 0 && j === 0,
      run: () => apply({ t: 'moveBlockBy', no, index: j, delta: -1 })
    },
    {
      label: '下へ移動',
      disabled: i === lastEntry && j === count - 1,
      run: () => apply({ t: 'moveBlockBy', no, index: j, delta: 1 })
    },
    { label: '', heading: true },
    {
      label: 'このブロックを削除',
      danger: true,
      run: () => {
        apply({ t: 'deleteBlock', tcId: tc.id, no, index: j })
        undoToast('ブロックを削除しました')
      }
    }
  ]

  const addItems = (no?: number): MenuItem[] => [
    ...(no === undefined
      ? [{ label: '画像ファイルを選ぶ…', run: () => void window.api.pickImages() }]
      : []),
    ...TEXT_BLOCKS.map((t) => ({ label: BLOCK_LABEL[t], run: () => setEditing({ type: t, no }) }))
  ]

  return (
    <div className="page">
      <div className="crumb">
        <AutoLine
          label="フォルダ"
          className="crumb-in"
          list="groups"
          value={tc.group}
          placeholder="フォルダ（未分類）"
          onCommit={(v) => patch({ group: v })}
        />
        <span className="num">／ {tc.id}</span>
      </div>
      <datalist id="groups">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <AutoLine
        label="項目名"
        className="title"
        value={tc.title}
        onCommit={(v) => patch({ title: v.trim() || '(無題)' })}
      />

      <div className="meta-row">
        <AutoLine
          label="分類"
          className="cat"
          list="cats"
          value={tc.category}
          placeholder="分類"
          onCommit={(v) => patch({ category: v.trim() })}
        />
        <datalist id="cats">
          {CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <div className="seg" role="radiogroup" aria-label="判定">
          {RESULTS.map((r) => (
            <button
              key={r}
              role="radio"
              aria-checked={tc.result === r}
              className={tc.result === r ? 'on ' + RESULT_CLASS[r] : ''}
              onClick={() => patch({ result: r })}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <dl className="props">
        {(
          [
            ['precondition', '前提条件'],
            ['steps', '手順'],
            ['expected', '期待結果'],
            ['note', '備考']
          ] as const
        ).map(([k, l]) => (
          <div key={k} className="prop">
            <dt>{l}</dt>
            <dd>
              <AutoText
                label={l}
                value={tc[k]}
                placeholder="クリックして入力"
                onCommit={(v) => patch({ [k]: v })}
              />
            </dd>
          </div>
        ))}
      </dl>

      <div className="sec-head">
        <h2>証跡</h2>
        <span className="num">{tc.entries.length}件</span>
      </div>
      {tc.entries.length === 0 && (
        <p className="empty">まだ証跡がありません。撮影するか、下の「証跡を追加」から作れます。</p>
      )}

      {tc.entries.map((e, i) => (
        <section
          className={
            'entry' +
            (over === 'e' + e.no ? ' drop-before' : '') +
            (dragging === 'e' + e.no ? ' dragging' : '')
          }
          key={e.no}
          onDragOver={(ev) => hover(ev, 'e' + e.no, ['text/entry', 'text/block'])}
          onDragLeave={() => setOver(null)}
          onDrop={(ev) => {
            // ブロックは、この証跡の末尾へ。証跡は、この証跡の直前へ。
            const blk = ev.dataTransfer.getData('text/block')
            if (blk) return dropBlock(ev, blk, e.no, Infinity)
            dropEntry(ev, e.no)
          }}
        >
          <div
            className="marker num handle"
            draggable
            title="ドラッグして並べ替え"
            onDragStart={(ev) => {
              ev.dataTransfer.setData('text/entry', String(e.no))
              ev.dataTransfer.setDragImage(ev.currentTarget.closest('.entry')!, 0, 0)
              setDragging('e' + e.no)
            }}
            onDragEnd={() => setDragging(null)}
          >
            {numbers.get(e.no)}
          </div>
          <div className="e-body">
            <div className="e-head">
              <AutoLine
                label="コメント"
                className="c"
                value={e.comment}
                placeholder="コメントを入力"
                onCommit={(v) => apply({ t: 'setEntryComment', tcId: tc.id, no: e.no, comment: v })}
              />
              <span className="time num">{e.time.slice(11)}</span>
              <Menu label="この証跡の操作" trigger="⋯" items={entryMenu(e.no, i)} className="end" />
            </div>
            <div className="blocks">
              {e.blocks.map((b, j) => (
                <div
                  className={
                    'block' +
                    (over === `b${e.no}:${j}` ? ' drop-before' : '') +
                    (dragging === `b${e.no}:${j}` ? ' dragging' : '')
                  }
                  key={j}
                  onDragOver={(ev) => hover(ev, `b${e.no}:${j}`, ['text/block'])}
                  onDragLeave={() => setOver(null)}
                  onDrop={(ev) => {
                    const blk = ev.dataTransfer.getData('text/block')
                    if (blk) dropBlock(ev, blk, e.no, j)
                  }}
                >
                  <span
                    className="grip handle"
                    draggable
                    title="ドラッグして移動（別の証跡へも）"
                    onDragStart={(ev) => {
                      ev.dataTransfer.setData('text/block', `${e.no}:${j}`)
                      ev.dataTransfer.setDragImage(ev.currentTarget.closest('.block')!, 0, 0)
                      setDragging(`b${e.no}:${j}`)
                    }}
                    onDragEnd={() => setDragging(null)}
                  >
                    ⋮⋮
                  </span>
                  <div
                    className="block-body"
                    role="button"
                    tabIndex={0}
                    title={b.type === 'image' ? 'クリックで拡大' : 'クリックで編集'}
                    onClick={(ev) => {
                      if ((ev.target as HTMLElement).closest('a')) return
                      if (b.type === 'image') setViewing(b)
                      else
                        setEditing({
                          type: b.type as TextBlockType,
                          no: e.no,
                          index: j,
                          initial: b
                        })
                    }}
                    onKeyDown={(ev) => {
                      if (ev.key !== 'Enter' || ev.target !== ev.currentTarget) return
                      if (b.type === 'image') setViewing(b)
                      else
                        setEditing({
                          type: b.type as TextBlockType,
                          no: e.no,
                          index: j,
                          initial: b
                        })
                    }}
                  >
                    <BlockView b={b} />
                  </div>
                  <Menu
                    label="このブロックの操作"
                    trigger="⋯"
                    items={blockMenu(e.no, i, j, b, e.blocks.length)}
                    className="end"
                  />
                </div>
              ))}
            </div>
            <Menu
              label="この証跡にブロックを追加"
              trigger="＋ この証跡にブロックを追加"
              items={addItems(e.no)}
              className="add-inline"
            />
          </div>
        </section>
      ))}

      <div
        className={'composer' + (over === 'end' ? ' drop-before' : '')}
        onDragOver={(ev) => hover(ev, 'end', ['text/entry'])}
        onDragLeave={() => setOver(null)}
        onDrop={(ev) => dropEntry(ev, null)}
      >
        <div className="marker">＋</div>
        <div className="chips">
          <Menu
            label="新しい証跡を追加"
            trigger="証跡を追加"
            items={addItems()}
            className="add-entry"
          />
          <span className="hint">撮影はホットキー・画像は貼り付けやドロップでも追加できます</span>
        </div>
      </div>

      <button className="delete-tc" onClick={removeTc}>
        このテストケースを削除
      </button>

      {editing && (
        <BlockDialog
          key={`${editing.no}-${editing.index}-${editing.type}`}
          type={editing.type}
          initial={editing.initial}
          onSubmit={submit}
          onClose={() => setEditing(null)}
        />
      )}
      {viewing && <ImageViewer b={viewing} onClose={() => setViewing(null)} />}
    </div>
  )
}
