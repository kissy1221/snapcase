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
        <section className="entry" key={e.no}>
          <div className="marker num" title="通し番号">
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
                <div className="block" key={j}>
                  <BlockView b={b} />
                  <span className="tools">
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

      <div className="composer">
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
