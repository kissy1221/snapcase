import { useEffect, useState } from 'react'
import { RESULTS } from '../../shared/constants'
import { orderedGroups } from '../../shared/ops'
import type { Manifest, TestCase } from '../../shared/types'
import { HOTKEY_LABEL, RESULT_CLASS, addTestCase } from './helpers'
import { select } from './store'
import { AutoText } from './ui'

const FIELDS = [
  ['precondition', '前提条件'],
  ['steps', '手順'],
  ['expected', '期待結果']
] as const satisfies ReadonlyArray<[keyof TestCase, string]>

/** テスト中に手前に置いておく小さな表示。開いているテストケース、判定、前提条件・手順・期待結果、撮影、前後の移動。 */
export default function Compact({
  m,
  tcId,
  onShoot
}: {
  m: Manifest
  tcId: string | null
  onShoot: () => void
}): React.JSX.Element {
  const [pinned, setPinned] = useState(false)
  // 通常表示に戻ると pinned は初期化されるが、実際の固定は解除されないためここで合わせる。
  useEffect(() => () => window.api.setPinned(false), [])
  const [fieldsOpen, setFieldsOpen] = useState(true)
  const order = orderedGroups(m).flatMap((g) => g.indexes.map((i) => m.testcases[i]))
  const at = order.findIndex((t) => t.id === tcId)
  const tc = order[at]
  const images =
    tc?.entries.flatMap((e) => e.blocks.flatMap((b) => (b.type === 'image' ? [b.image] : []))) ?? []
  const fields = tc ? FIELDS.filter(([k]) => tc[k]) : []
  const move = (d: number): void => select(order[at + d].id)

  return (
    <div className="compact">
      <header className="titlebar">
        <button
          className={'pin' + (pinned ? ' on' : '')}
          aria-pressed={pinned}
          onClick={() => {
            window.api.setPinned(!pinned)
            setPinned(!pinned)
          }}
        >
          手前に固定
        </button>
      </header>
      {!tc ? (
        <div className="cp-body">
          <p className="empty">テストケースがありません。</p>
          <button className="big-shutter" onClick={() => addTestCase(m)}>
            <span className="label">テストケースを追加</span>
          </button>
        </div>
      ) : (
        <div className="cp-body">
          <div>
            <div className="crumb num">
              {tc.group || '未分類'} ／ {tc.id}
            </div>
            <h2>{tc.title}</h2>
          </div>
          <div className="seg" role="radiogroup" aria-label="判定">
            {RESULTS.map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={tc.result === r}
                className={tc.result === r ? 'on ' + RESULT_CLASS[r] : ''}
                onClick={() =>
                  window.api.apply({ t: 'updateTestCase', id: tc.id, patch: { result: r } })
                }
              >
                {r}
              </button>
            ))}
          </div>
          {fields.length > 0 && (
            <details
              className="cp-fields"
              open={fieldsOpen}
              onToggle={(e) => setFieldsOpen(e.currentTarget.open)}
            >
              <summary>詳細</summary>
              <dl className="props">
                {fields.map(([k, l]) => (
                  <div key={k} className="prop">
                    <dt>{l}</dt>
                    <dd>
                      <AutoText
                        label={l}
                        value={tc[k]}
                        onCommit={(v) =>
                          window.api.apply({ t: 'updateTestCase', id: tc.id, patch: { [k]: v } })
                        }
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          <button className="big-shutter" onClick={onShoot}>
            <span className="ring">
              <i />
            </span>
            <span className="label">撮影</span>
            <span className="kbd">
              {HOTKEY_LABEL.map((k) => (
                <b key={k}>{k}</b>
              ))}
            </span>
          </button>
          <div>
            <div className="sec-head">
              <h2>ステップ</h2>
              <span className="num">{tc.entries.length}件</span>
            </div>
            <div className="thumbs">
              {images.slice(-6).map((n) => (
                <img key={n} src={`evidence://img/${n}`} alt="" />
              ))}
            </div>
          </div>
        </div>
      )}
      {tc && (
        <footer className="cp-foot num">
          <button disabled={at <= 0} onClick={() => move(-1)}>
            ‹ {order[at - 1]?.id}
          </button>
          <button disabled={at >= order.length - 1} onClick={() => move(1)}>
            {order[at + 1]?.id} ›
          </button>
        </footer>
      )}
    </div>
  )
}
