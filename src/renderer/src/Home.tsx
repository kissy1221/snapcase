import { useEffect, useState } from 'react'
import type { SessionSummary } from '../../shared/api'
import './assets/home.css'

const JUDGE = [
  ['OK', 'var(--ok)'],
  ['NG', 'var(--ng)'],
  ['保留', 'var(--hold)'],
  ['未実施', 'var(--none)']
] as const

const fmt = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })

function Progress({ s }: { s: SessionSummary }): React.JSX.Element {
  return (
    <div
      className="bar"
      role="img"
      aria-label={JUDGE.map(([k]) => `${k} ${s.counts[k]}`).join('、')}
    >
      {JUDGE.map(([k, color]) => (
        <i key={k} style={{ flex: s.counts[k], background: color }} />
      ))}
    </div>
  )
}

export default function Home(): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    window.api.listSessions().then(setSessions)
  }, [])

  const open = (n: string): void => {
    setError('')
    window.api
      .openSession(n)
      .catch((e: Error) =>
        setError(e.message.replace(/^Error invoking remote method '.*?': Error: /, ''))
      )
  }

  return (
    <main className="home">
      <h1>証跡作ったったー</h1>
      <form
        className="new"
        onSubmit={(e) => {
          e.preventDefault()
          open(name)
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="セッション名（例: 会員登録機能 結合試験）"
          aria-label="セッション名"
          autoFocus
        />
        <button type="submit" disabled={!name.trim()}>
          {sessions?.some((s) => s.name === name.trim()) ? '続きから開く' : '新しく始める'}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {sessions && sessions.length === 0 && (
        <p className="empty">
          まだセッションがありません。名前を入力して、最初のセッションを作りましょう。
        </p>
      )}
      <ul className="sessions">
        {sessions?.map((s) => (
          <li key={s.name}>
            <button onClick={() => open(s.name)}>
              <span className="name">{s.name}</span>
              <span className="meta num">
                テストケース {s.total}件 ・ 証跡 {s.entries}件 ・ {fmt.format(s.updatedAt)}
              </span>
              <Progress s={s} />
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
