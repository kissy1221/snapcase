import { useState } from 'react'
import { CATEGORIES, RESULTS } from '../../shared/constants'
import { displayNumbers } from '../../shared/ops'
import type { Block, Manifest, TestCase } from '../../shared/types'
import { BLOCK_LABEL, TEXT_BLOCKS, type TextBlockType } from './blockMeta'
import { BlockDialog, BlockView } from './Blocks'
import { RESULT_CLASS } from './helpers'
import { OVERVIEW, select } from './store'
import { AutoLine, AutoText } from './ui'

type Editing = { type: TextBlockType; no?: number; index?: number; initial?: Block }

export default function TestCasePage({ m, tc }: { m: Manifest; tc: TestCase }): React.JSX.Element {
  const [editing, setEditing] = useState<Editing | null>(null)
  const [over, setOver] = useState<string | null>(null) // ドロップ位置の強調(直前に線を出す)
  const numbers = displayNumbers(m)
  const apply = window.api.apply
  const patch = (p: Partial<TestCase>): Promise<void> =>
    apply({ t: 'updateTestCase', id: tc.id, patch: p })
  const groups = [...new Set(m.testcases.map((t) => t.group).filter(Boolean))]

  const submit = (b: Block): void => {
    if (!editing) return
    if (editing.no === undefined) apply({ t: 'addEntry', tcId: tc.id, blocks: [b] })
    else if (editing.index === undefined)
      apply({ t: 'addBlock', tcId: tc.id, no: editing.no, block: b })
    else apply({ t: 'updateBlock', tcId: tc.id, no: editing.no, index: editing.index, block: b })
    setEditing(null)
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

  const remove = (): void => {
    const n = tc.entries.length
    if (n && !confirm(`${tc.id} と、証跡 ${n} 件を削除します。元に戻せません。`)) return
    select(OVERVIEW)
    apply({ t: 'deleteTestCase', id: tc.id })
  }

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
        <p className="empty">まだ証跡がありません。下のボタンで追加できます。</p>
      )}

      {tc.entries.map((e, i) => (
        <section
          className={'entry' + (over === 'e' + e.no ? ' drop-before' : '')}
          key={e.no}
          onDragOver={(ev) => hover(ev, 'e' + e.no, ['text/entry', 'text/block'])}
          onDragLeave={() => setOver(null)}
          onDrop={(ev) => {
            // ブロックは、この記録の末尾へ。記録は、この記録の直前へ。
            const blk = ev.dataTransfer.getData('text/block')
            if (blk) return dropBlock(ev, blk, e.no, Infinity)
            dropEntry(ev, e.no)
          }}
        >
          <div
            className="marker num handle"
            draggable
            title="ドラッグして並べ替え（別のテストケースへは、左の一覧にドロップ）"
            onDragStart={(ev) => {
              ev.dataTransfer.setData('text/entry', String(e.no))
              ev.dataTransfer.setDragImage(ev.currentTarget.closest('.entry')!, 0, 0)
            }}
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
              <span className="tools">
                <button
                  aria-label="上へ"
                  disabled={i === 0}
                  onClick={() => apply({ t: 'moveEntry', tcId: tc.id, no: e.no, delta: -1 })}
                >
                  ↑
                </button>
                <button
                  aria-label="下へ"
                  disabled={i === tc.entries.length - 1}
                  onClick={() => apply({ t: 'moveEntry', tcId: tc.id, no: e.no, delta: 1 })}
                >
                  ↓
                </button>
                <button
                  aria-label="この証跡を削除"
                  onClick={() => apply({ t: 'deleteEntry', tcId: tc.id, no: e.no })}
                >
                  削除
                </button>
              </span>
            </div>
            <div className="blocks">
              {e.blocks.map((b, j) => (
                <div
                  className={'block' + (over === `b${e.no}:${j}` ? ' drop-before' : '')}
                  key={j}
                  onDragOver={(ev) => hover(ev, `b${e.no}:${j}`, ['text/block'])}
                  onDragLeave={() => setOver(null)}
                  onDrop={(ev) => {
                    const blk = ev.dataTransfer.getData('text/block')
                    if (blk) dropBlock(ev, blk, e.no, j)
                  }}
                >
                  <BlockView b={b} />
                  <span className="tools">
                    <button
                      className="handle"
                      aria-label="ドラッグしてブロックを移動"
                      title="ドラッグして移動（別の記録へも）"
                      draggable
                      onDragStart={(ev) => {
                        ev.dataTransfer.setData('text/block', `${e.no}:${j}`)
                        ev.dataTransfer.setDragImage(ev.currentTarget.closest('.block')!, 0, 0)
                      }}
                    >
                      ⋮⋮
                    </button>
                    <button
                      aria-label="ブロックを上へ"
                      disabled={j === 0}
                      onClick={() => apply({ t: 'moveBlockBy', no: e.no, index: j, delta: -1 })}
                    >
                      ↑
                    </button>
                    <button
                      aria-label="ブロックを下へ"
                      disabled={j === e.blocks.length - 1}
                      onClick={() => apply({ t: 'moveBlockBy', no: e.no, index: j, delta: 1 })}
                    >
                      ↓
                    </button>
                    {b.type !== 'image' && (
                      <button
                        aria-label="ブロックを編集"
                        onClick={() =>
                          setEditing({
                            type: b.type as TextBlockType,
                            no: e.no,
                            index: j,
                            initial: b
                          })
                        }
                      >
                        編集
                      </button>
                    )}
                    <button
                      aria-label="ブロックを削除"
                      onClick={() => apply({ t: 'deleteBlock', tcId: tc.id, no: e.no, index: j })}
                    >
                      ×
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <details className="add-block">
              <summary>＋ ブロックを追加</summary>
              <span className="chips">
                {TEXT_BLOCKS.map((t) => (
                  <button
                    key={t}
                    className="chip"
                    onClick={() => setEditing({ type: t, no: e.no })}
                  >
                    {BLOCK_LABEL[t]}
                  </button>
                ))}
              </span>
            </details>
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
          <button className="chip" onClick={() => window.api.pickImages()}>
            画像
          </button>
          {TEXT_BLOCKS.map((t) => (
            <button key={t} className="chip" onClick={() => setEditing({ type: t })}>
              {BLOCK_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <button className="danger" onClick={remove}>
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
    </div>
  )
}
