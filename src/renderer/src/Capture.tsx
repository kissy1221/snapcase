import { useEffect, useState } from 'react'
import type { WindowChoice } from '../../shared/api'
import type { Manifest } from '../../shared/types'
import { addTestCase, HOTKEY_LABEL } from './helpers'
import { Dialog } from './ui'

/** 画面下部の撮影ボタン。押すと撮影するウィンドウを選べる(選択は親が開く)。 */
export function Shutter({
  m,
  target,
  onPick
}: {
  m: Manifest
  target: string | null
  onPick: () => void
}): React.JSX.Element {
  return (
    <button className="shutter" onClick={() => (target ? onPick() : addTestCase(m))}>
      <span className="ring">
        <i />
      </span>
      <span className="label num">{target ? `${target} に撮影` : 'テストケースを追加'}</span>
      <span className="kbd">
        {HOTKEY_LABEL.map((k) => (
          <b key={k}>{k}</b>
        ))}
      </span>
    </button>
  )
}

export function WindowPicker({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [list, setList] = useState<WindowChoice[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    window.api
      .listWindows()
      .then(setList)
      .catch((e: Error) =>
        setError(e.message.replace(/^Error invoking remote method '.*?': \w*Error: /, ''))
      )
  }, [])

  return (
    <Dialog title="撮影するウィンドウを選ぶ" onClose={onClose}>
      {error && <p className="error">{error}</p>}
      {!list && !error && <p className="empty">ウィンドウを探しています…</p>}
      {list && list.length === 0 && <p className="empty">撮影できるウィンドウがありません。</p>}
      <div className="picker">
        {list?.map((w) => (
          <button
            key={w.id}
            onClick={() => {
              onClose()
              window.api.captureSource(w.id)
            }}
          >
            <img src={w.thumb} alt="" />
            <span>
              {w.screen ? '🖥 ' : ''}
              {w.name}
            </span>
          </button>
        ))}
      </div>
      <div className="actions">
        <button type="button" onClick={onClose}>
          キャンセル
        </button>
      </div>
    </Dialog>
  )
}
