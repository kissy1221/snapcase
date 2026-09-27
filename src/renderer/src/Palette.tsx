import { useMemo, useState } from 'react'
import { Dialog } from './ui'

export interface Command {
  id: string
  label: string
  run: () => void
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
    return commands.filter((c) => words.every((w) => c.label.toLowerCase().includes(w)))
  }, [q, commands])
  const cur = Math.min(at, Math.max(0, shown.length - 1))

  const run = (c?: Command): void => {
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
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
