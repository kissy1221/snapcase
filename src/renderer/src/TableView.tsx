import { useMemo, useState } from 'react'
import { CATEGORIES, RESULTS } from '../../shared/constants'
import { orderedGroups } from '../../shared/ops'
import { doneRate, passRate, summarize, type Tally } from '../../shared/summary'
import type { Manifest, Result, TestCase } from '../../shared/types'
import { COLOR, RESULT_CLASS, addTestCase } from './helpers'
import { select } from './store'
import { AutoLine, AutoText } from './ui'

const pct = (v: number | null): string => (v === null ? '―' : Math.round(v * 100) + '%')

/** 判定ごとの割合を1本の帯で見せる。 */
function Bar({ t }: { t: Tally }): React.JSX.Element {
  return (
    <div className="bar" role="img" aria-label={RESULTS.map((r) => `${r} ${t[r]}`).join('、')}>
      {RESULTS.map((r) => (
        <i key={r} style={{ flex: t[r], background: COLOR[r] }} />
      ))}
    </div>
  )
}

const COLS: { key: keyof TestCase | 'n'; label: string; w: number }[] = [
  { key: 'id', label: 'ID', w: 84 },
  { key: 'group', label: 'フォルダ', w: 120 },
  { key: 'title', label: '項目名', w: 220 },
  { key: 'category', label: '分類', w: 96 },
  { key: 'precondition', label: '前提条件', w: 200 },
  { key: 'steps', label: '手順', w: 240 },
  { key: 'expected', label: '期待結果', w: 200 },
  { key: 'result', label: '判定', w: 104 },
  { key: 'note', label: '備考', w: 160 },
  { key: 'n', label: 'ステップ', w: 76 }
]

export default function TableView({ m }: { m: Manifest }): React.JSX.Element {
  const [filter, setFilter] = useState<Result | null>(null)
  const [q, setQ] = useState('')
  const s = useMemo(() => summarize(m), [m])
  const groups = [...new Set(m.testcases.map((t) => t.group).filter(Boolean))]

  const rows = orderedGroups(m)
    .flatMap((g) => g.indexes.map((i) => m.testcases[i]))
    .filter((t) => !filter || t.result === filter)
    .filter(
      (t) =>
        !q ||
        [t.id, t.group, t.title, t.category, t.precondition, t.steps, t.expected, t.note].some(
          (v) => v.toLowerCase().includes(q.toLowerCase())
        )
    )
  const patch = (id: string, p: Partial<TestCase>): Promise<void> =>
    window.api.apply({ t: 'updateTestCase', id, patch: p })

  return (
    <div className="page wide">
      <div className="crumb">一覧表</div>
      <h1 className="title static">サマリ</h1>

      <div className="sum">
        <div className="sum-rates">
          <div>
            <span className="big num">{pct(doneRate(s.all))}</span>
            <span className="cap">
              実施率（{s.all.total - s.all.未実施} / {s.all.total}件）
            </span>
          </div>
          <div>
            <span className="big num">{pct(passRate(s.all))}</span>
            <span className="cap">
              合格率（OK {s.all.OK} / OK+NG {s.all.OK + s.all.NG}）
            </span>
          </div>
          <div>
            <span className="big num">{s.steps}</span>
            <span className="cap">ステップ</span>
          </div>
        </div>
        <Bar t={s.all} />
        <div className="cards">
          {RESULTS.map((r) => (
            <button
              key={r}
              className={'card' + (filter === r ? ' on' : '')}
              aria-pressed={filter === r}
              onClick={() => setFilter(filter === r ? null : r)}
            >
              <span className={'dot ' + RESULT_CLASS[r]} />
              <span className="n num">{s.all[r]}</span>
              <span>{r}</span>
            </button>
          ))}
        </div>

        {s.groups.length > 1 && (
          <table className="by-group">
            <thead>
              <tr>
                <th>フォルダ</th>
                {RESULTS.map((r) => (
                  <th key={r} className="r">
                    {r}
                  </th>
                ))}
                <th className="r">合計</th>
                <th>実施率</th>
              </tr>
            </thead>
            <tbody>
              {s.groups.map((g) => (
                <tr key={g.name}>
                  <td>{g.name}</td>
                  {RESULTS.map((r) => (
                    <td key={r} className={'r num' + (r === 'NG' && g.tally.NG ? ' ng' : '')}>
                      {g.tally[r]}
                    </td>
                  ))}
                  <td className="r num">{g.tally.total}</td>
                  <td className="rate">
                    <Bar t={g.tally} />
                    <span className="num">{pct(doneRate(g.tally))}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="sec-head">
        <h2>テストケース</h2>
        <span className="num">
          {rows.length}
          {rows.length !== m.testcases.length && ` / ${m.testcases.length}`}件
        </span>
        <span className="spacer" />
        <input
          className="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="絞り込み"
          aria-label="絞り込み"
        />
        {(filter || q) && (
          <button className="chip" onClick={() => (setFilter(null), setQ(''))}>
            解除
          </button>
        )}
      </div>

      <datalist id="t-groups">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <datalist id="t-cats">
        {CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <div className="grid-wrap">
        <table className="grid">
          <colgroup>
            {COLS.map((c) => (
              <col key={c.key} style={{ width: c.w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLS.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className={t.result === 'NG' ? 'ng' : ''}>
                <td>
                  <button
                    className="link id num"
                    onClick={() => select(t.id)}
                    title="このテストケースを開く"
                  >
                    {t.id}
                  </button>
                </td>
                <td>
                  <AutoLine
                    label="フォルダ"
                    list="t-groups"
                    value={t.group}
                    onCommit={(v) => patch(t.id, { group: v })}
                  />
                </td>
                <td>
                  <AutoText
                    label="項目名"
                    value={t.title}
                    onCommit={(v) => patch(t.id, { title: v.trim() || '(無題)' })}
                  />
                </td>
                <td>
                  <AutoLine
                    label="分類"
                    list="t-cats"
                    value={t.category}
                    onCommit={(v) => patch(t.id, { category: v.trim() })}
                  />
                </td>
                <td>
                  <AutoText
                    label="前提条件"
                    value={t.precondition}
                    onCommit={(v) => patch(t.id, { precondition: v })}
                  />
                </td>
                <td>
                  <AutoText
                    label="手順"
                    value={t.steps}
                    onCommit={(v) => patch(t.id, { steps: v })}
                  />
                </td>
                <td>
                  <AutoText
                    label="期待結果"
                    value={t.expected}
                    onCommit={(v) => patch(t.id, { expected: v })}
                  />
                </td>
                <td>
                  <select
                    className={'res ' + RESULT_CLASS[t.result]}
                    aria-label="判定"
                    value={t.result}
                    onChange={(e) => patch(t.id, { result: e.target.value as Result })}
                  >
                    {RESULTS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <AutoText
                    label="備考"
                    value={t.note}
                    onCommit={(v) => patch(t.id, { note: v })}
                  />
                </td>
                <td className="num c">{t.entries.length}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="none">
                  {m.testcases.length
                    ? '条件に合うテストケースがありません。'
                    : 'テストケースがありません。'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button className="add-row" onClick={() => addTestCase(m, '', false)}>
        ＋ テストケースを追加
      </button>
    </div>
  )
}
