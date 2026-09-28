import { useEffect, useState } from 'react'
import type { ExportFormat, Settings, Theme } from '../../shared/api'
import { applyGlass, hotkeyParts, IS_MAC } from './helpers'
import { Dialog } from './ui'

/** キー入力を Electron の accelerator 文字列にする。修飾キーだけ・修飾キー無し(F キー以外)は null。 */
function toAccelerator(e: React.KeyboardEvent): string | null {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null
  const mods = [
    e.ctrlKey && 'Control',
    e.altKey && 'Alt',
    e.shiftKey && 'Shift',
    e.metaKey && (IS_MAC ? 'Command' : 'Super')
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

const label = (acc: string): string => hotkeyParts(acc).join(IS_MAC ? '' : '+')

const FORMATS: { id: ExportFormat; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'xlsx', label: 'Excel' },
  { id: 'html', label: 'HTML' },
  { id: 'md', label: 'Markdown' }
]

const THEMES: { id: Theme; label: string }[] = [
  { id: 'system', label: 'システム' },
  { id: 'light', label: 'ライト' },
  { id: 'dark', label: 'ダーク' }
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
          <div className="field">
            <span className="lbl">判定のホットキー（ここを押した状態で、使いたいキーを押す）</span>
            <span className="inline">
              {(['OK', 'NG', '保留'] as const).map((r) => (
                <label key={r}>
                  {r}
                  <input
                    className="hotkey"
                    readOnly
                    value={label(s.verdictHotkeys[r])}
                    onKeyDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const acc = toAccelerator(e)
                      if (acc && acc !== s.verdictHotkeys[r])
                        update({ verdictHotkeys: { ...s.verdictHotkeys, [r]: acc } })
                    }}
                  />
                </label>
              ))}
            </span>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="field">
            <span className="lbl">テーマ</span>
            <div className="theme-picker" role="radiogroup" aria-label="テーマ">
              {THEMES.map((t) => (
                <label key={t.id} className={`theme-opt${s.theme === t.id ? ' sel' : ''}`}>
                  <input
                    type="radio"
                    name="theme"
                    value={t.id}
                    checked={s.theme === t.id}
                    onChange={() => update({ theme: t.id })}
                  />
                  <span className={`swatch ${t.id}`} aria-hidden="true" />
                  {t.label}
                </label>
              ))}
            </div>
          </div>
          <label>
            ウィンドウの鏡面（すりガラス）の度合い
            <input
              type="range"
              min={0}
              max={100}
              value={s.glass}
              onChange={(e) => {
                // ドラッグ中は見た目だけ即座に反映し、保存(IPC)はドラッグを離すまで送らない。
                // 毎ティック送ると、応答が前後して値がガタつくため。
                const glass = Number(e.currentTarget.value)
                applyGlass(glass)
                setS({ ...s, glass })
              }}
              onMouseUp={(e) => update({ glass: Number(e.currentTarget.value) })}
              onKeyUp={(e) => update({ glass: Number(e.currentTarget.value) })}
            />
          </label>
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
          <label className="check">
            <input
              type="checkbox"
              checked={s.autoAdvance}
              onChange={(e) => update({ autoAdvance: e.target.checked })}
            />
            <span>判定したら次の未実施へ移る</span>
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
