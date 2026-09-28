import { useMemo, useState } from 'react'
import { Dialog } from './ui'

export interface Command {
  id: string
  label: string
  run: () => void
  /** 項目名以外の検索対象(手順・記録のコメントなど)。一致すると抜粋を出し、選ぶと run の代わりに使う。 */
  extra?: { text: string; run?: () => void }[]
}

interface Shown {
  id: string
  label: string
  excerpt: string | null
  run: () => void
}

/** 一致箇所の前後を切り出す。行頭・行末なら省略記号は付けない。 */
function excerptOf(text: string, words: string[]): string {
  const lower = text.toLowerCase()
  let at = -1
  for (const w of words) {
    const i = lower.indexOf(w)
    if (i >= 0 && (at < 0 || i < at)) at = i
  }
  if (at < 0) at = 0
  const start = Math.max(0, at - 20)
  const end = Math.min(text.length, at + 40)
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim()
  return (start > 0 ? '…' : '') + body + (end < text.length ? '…' : '')
}

/** ⌘K / Ctrl+K のコマンドパレット。入力で絞り込み、↑↓ で選び、Enter で実行する。 */
export default function Palette({
  commands,
  onClose
}: {
  commands: Command[]
  onClose: () => void
}): React.JSX.Element {
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    const out: Shown[] = []
    for (const c of commands) {
      const label = c.label.toLowerCase()
      if (words.every((w) => label.includes(w))) {
        out.push({ id: c.id, label: c.label, excerpt: null, run: c.run })
        continue
      }
      const hit = c.extra?.find((x) => {
        const text = x.text.toLowerCase()
        return words.every((w) => label.includes(w) || text.includes(w))
      })
      if (hit)
        out.push({
          id: c.id,
          label: c.label,
          excerpt: excerptOf(hit.text, words),
          run: hit.run ?? c.run
        })
    }
    return out
  }, [q, commands])
  const cur = Math.min(at, Math.max(0, shown.length - 1))

  const run = (c?: Shown): void => {
    if (!c) return
    onClose()
    c.run()
  }

  return (
    <Dialog title="コマンド" onClose={onClose}>
      <input
        className="palette-input"
        autoFocus
        value={q}
        placeholder="テストケースや操作を検索"
        aria-label="検索"
        onChange={(e) => {
          setQ(e.target.value)
          setAt(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setAt(
              e.key === 'ArrowDown' ? Math.min(cur + 1, shown.length - 1) : Math.max(cur - 1, 0)
            )
          }
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) run(shown[cur])
        }}
      />
      <ul className="palette-list" role="listbox">
        {shown.length === 0 && <li className="none">見つかりません</li>}
        {shown.map((c, i) => (
          <li key={c.id} role="option" aria-selected={i === cur}>
            <button
              className={i === cur ? 'on' : ''}
              onMouseMove={() => setAt(i)}
              onClick={() => run(c)}
            >
              {c.label}
              {c.excerpt && <span className="excerpt">{c.excerpt}</span>}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
