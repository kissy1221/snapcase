import { useEffect, useState } from 'react'
import type { ExportFormat, Settings } from '../../shared/api'
import { Dialog } from './ui'

const MAC = /Mac/.test(navigator.platform)
const SYMBOL: Record<string, string> = {
  Control: MAC ? '⌃' : 'Ctrl',
  Alt: MAC ? '⌥' : 'Alt',
  Shift: MAC ? '⇧' : 'Shift',
  Command: '⌘',
  Super: 'Win'
}

/** キー入力を Electron の accelerator 文字列にする。修飾キーだけ・修飾キー無し(F キー以外)は null。 */
function toAccelerator(e: React.KeyboardEvent): string | null {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null
  const mods = [
    e.ctrlKey && 'Control',
    e.altKey && 'Alt',
    e.shiftKey && 'Shift',
    e.metaKey && (MAC ? 'Command' : 'Super')
  ].filter(Boolean)
  const named: Record<string, string> = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ' ': 'Space'
  }
  const key = named[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key)
  if (!mods.length && !/^F\d+$/.test(key)) return null
  return [...mods, key].join('+')
}

const label = (acc: string): string =>
  acc
    .split('+')
    .map((k) => SYMBOL[k] ?? k)
    .join(MAC ? '' : '+')

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'xlsx', label: 'Excel' },
  { id: 'html', label: 'HTML' },
  { id: 'md', label: 'Markdown' }
]

export default function SettingsDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [s, setS] = useState<Settings | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    window.api.getSettings().then(setS)
  }, [])

  // 先に画面へ反映し、main で保存できなかったとき(ホットキーが使えない等)だけ元に戻す。
  const update = async (patch: Partial<Settings>): Promise<void> => {
    const before = s
    if (before) setS({ ...before, ...patch })
    const r = await window.api.setSettings(patch)
    if ('error' in r) {
      setError(r.error)
      setS(before)
    } else {
      setError('')
      setS(r.settings)
    }
  }

  return (
    <Dialog title="設定" onClose={onClose}>
      {s && (
        <div className="form">
          <label>
            撮影のホットキー（ここを押した状態で、使いたいキーを押す）
            <input
              className="hotkey"
              readOnly
              value={label(s.hotkey)}
              onKeyDown={(e) => {
                e.preventDefault()
                e.stopPropagation() // ⌘K などがパレットを開かないように
                const acc = toAccelerator(e)
                if (acc && acc !== s.hotkey) update({ hotkey: acc })
              }}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <label className="check">
            <input
              type="checkbox"
              checked={s.openEditor}
              onChange={(e) => update({ openEditor: e.target.checked })}
            />
            <span>
              撮影したあとに編集画面を開く
              <small className="note-s">
                {' '}
                オフにすると、注釈やコメント無しでそのまま保存します
              </small>
            </span>
          </label>
          <div className="field">
            <span className="lbl">閉じるときに書き出す形式</span>
            <span className="inline">
              {FORMATS.map((f) => (
                <label key={f.id} className="check">
                  <input
                    type="checkbox"
                    checked={s.exportOnClose.includes(f.id)}
                    onChange={(e) =>
                      update({
                        exportOnClose: e.target.checked
                          ? [...s.exportOnClose, f.id]
                          : s.exportOnClose.filter((x) => x !== f.id)
                      })
                    }
                  />
                  {f.label}
                </label>
              ))}
            </span>
          </div>
          <div className="field">
            <span className="lbl">保存先（次にセッションを開くときから変わります）</span>
            <span className="inline">
              <code className="path">{s.dataDir || '書類/Snapcase（既定）'}</code>
              <button
                type="button"
                className="chip"
                onClick={async () => {
                  const dir = await window.api.chooseDataDir()
                  if (dir) update({ dataDir: dir })
                }}
              >
                変更
              </button>
              {s.dataDir && (
                <button type="button" className="chip" onClick={() => update({ dataDir: '' })}>
                  既定に戻す
                </button>
              )}
            </span>
          </div>
          <div className="actions">
            <button type="button" className="primary" onClick={onClose}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
