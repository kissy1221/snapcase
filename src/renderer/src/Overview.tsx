import { META_FIELDS, RESULTS } from '../../shared/constants'
import type { Manifest } from '../../shared/types'
import { AutoLine, AutoText } from './ui'

export default function Overview({ m }: { m: Manifest }): React.JSX.Element {
  const entries = m.testcases.reduce((n, t) => n + t.entries.length, 0)
  const set = (key: string, v: string): Promise<void> =>
    window.api.apply({ t: 'setMeta', meta: { [key]: v } })

  return (
    <div className="page">
      <div className="crumb">概要</div>
      <h1 className="title static">{m.session}</h1>
      <p className="summary num">
        テストケース {m.testcases.length}件 ・ ステップ {entries}件{' ・ '}
        {RESULTS.map((r) => `${r} ${m.testcases.filter((t) => t.result === r).length}`).join(' / ')}
      </p>

      <div className="sec-head">
        <h2>実施情報</h2>
        <span>書き出したファイルの先頭に載ります。空欄の項目は載りません。</span>
      </div>
      <dl className="props flat">
        {META_FIELDS.map(([k, label]) => (
          <div key={k} className="prop">
            <dt>{label}</dt>
            <dd>
              {k === 'note' ? (
                <AutoText
                  label={label}
                  value={m.meta[k] ?? ''}
                  placeholder="クリックして入力"
                  onCommit={(v) => set(k, v)}
                />
              ) : (
                <AutoLine
                  label={label}
                  className="line"
                  value={m.meta[k] ?? ''}
                  placeholder="クリックして入力"
                  onCommit={(v) => set(k, v)}
                />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
