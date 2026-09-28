import { useEffect, useState } from 'react'
import type { SessionSummary } from '../../shared/api'
import { Menu, type MenuItem } from './Menu'
import SettingsDialog from './Settings'
import { confirmAsk, toast } from './store'
import { Dialog, Toaster } from './ui'
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

/** 名前を変えるダイアログ。既存の名前と重なる・開いている場合は main 側が断り、その旨を出す。 */
function RenameDialog({
  s,
  onClose,
  onRenamed
}: {
  s: SessionSummary
  onClose: () => void
  onRenamed: () => void
}): React.JSX.Element {
  const [name, setName] = useState(s.name)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (): Promise<void> => {
    const next = name.trim()
    if (!next || next === s.name) return onClose()
    setBusy(true)
    const r = await window.api.renameSession(s.name, next)
    if ('error' in r) {
      setBusy(false)
      setError(r.error)
      return
    }
    onClose()
    onRenamed()
  }

  return (
    <Dialog title="名前を変更" onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run()
        }}
      >
        <label>
          セッション名
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="セッション名"
            autoFocus
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="button" onClick={onClose} disabled={busy}>
            キャンセル
          </button>
          <button type="submit" className="primary" disabled={busy || !name.trim()}>
            変更する
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export default function Home(): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [settings, setSettings] = useState(false)
  const [renaming, setRenaming] = useState<SessionSummary | null>(null)
  const [dup, setDup] = useState<SessionSummary | null>(null)
  const [dupName, setDupName] = useState('')
  const [dupError, setDupError] = useState('')

  const refresh = (): void => {
    window.api.listSessions().then(setSessions)
  }
  useEffect(refresh, [])

  const startDuplicate = (s: SessionSummary): void => {
    setDup(s)
    setDupName(`${s.name} のコピー`)
    setDupError('')
  }

  // 成功すると main が新しいセッションを開くので、Home は Workspace に置き換わる。
  const duplicate = async (): Promise<void> => {
    if (!dup) return
    const r = await window.api.duplicateSession(dup.name, dupName)
    if ('error' in r) setDupError(r.error)
  }

  const open = (n: string): void => {
    setError('')
    window.api
      .openSession(n)
      .catch((e: Error) =>
        setError(e.message.replace(/^Error invoking remote method '.*?': Error: /, ''))
      )
  }

  const del = async (s: SessionSummary): Promise<void> => {
    const ok = await confirmAsk({
      title: `${s.name} を削除しますか？`,
      message: 'ごみ箱に移動します。元に戻すには OS のごみ箱から戻してください。',
      okLabel: '削除する'
    })
    if (!ok) return
    const r = await window.api.deleteSession(s.name)
    if (r && 'error' in r) return toast(`削除できませんでした: ${r.error}`)
    refresh()
  }

  const sessionMenu = (s: SessionSummary): MenuItem[] => [
    { label: '名前を変更', run: () => setRenaming(s) },
    { label: 'このケースで新規作成', run: () => startDuplicate(s) },
    { label: '削除', danger: true, run: () => del(s) }
  ]

  return (
    <main className="home">
      <button className="home-gear" onClick={() => setSettings(true)}>
        設定
      </button>
      <h1>Snapcase</h1>
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
                テストケース {s.total}件 ・ ステップ {s.entries}件 ・ {fmt.format(s.updatedAt)}
              </span>
              <Progress s={s} />
            </button>
            <Menu
              className="end"
              label={`${s.name} のメニュー`}
              trigger="⋯"
              items={sessionMenu(s)}
            />
          </li>
        ))}
      </ul>
      {dup && (
        <Dialog title="このケースで新規作成" onClose={() => setDup(null)}>
          <form
            className="new"
            onSubmit={(e) => {
              e.preventDefault()
              void duplicate()
            }}
          >
            <input
              value={dupName}
              onChange={(e) => setDupName(e.target.value)}
              aria-label="新しいセッション名"
              autoFocus
            />
            <button type="submit" disabled={!dupName.trim()}>
              作成する
            </button>
          </form>
          {dupError && (
            <p className="error" role="alert">
              {dupError}
            </p>
          )}
        </Dialog>
      )}
      {settings && <SettingsDialog onClose={() => setSettings(false)} />}
      {renaming && (
        <RenameDialog s={renaming} onClose={() => setRenaming(null)} onRenamed={refresh} />
      )}
      <Toaster />
    </main>
  )
}
