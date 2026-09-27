import { useState } from 'react'
import type { ExportFormat } from '../../shared/api'
import { toast } from './store'
import { Dialog } from './ui'

const FORMATS: { id: ExportFormat; label: string; note: string }[] = [
  { id: 'pdf', label: 'PDF', note: '提出用。しおり（目次）とページ番号つき' },
  { id: 'xlsx', label: 'Excel', note: '画像を埋め込んだ表' },
  { id: 'html', label: 'HTML', note: '画像を埋め込んだ単一ファイル' },
  { id: 'md', label: 'Markdown', note: '画像は images/ を参照。差分管理向け' }
]
const KEY = 'export-formats'
const saved = (): ExportFormat[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '') as ExportFormat[]
  } catch {
    return ['pdf', 'xlsx']
  }
}

export default function ExportDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [sel, setSel] = useState<Set<ExportFormat>>(new Set(saved()))
  const [busy, setBusy] = useState(false)

  const run = async (): Promise<void> => {
    setBusy(true)
    const formats = FORMATS.filter((f) => sel.has(f.id)).map((f) => f.id)
    localStorage.setItem(KEY, JSON.stringify(formats))
    const r = await window.api.exportSession(formats)
    onClose()
    if ('error' in r) toast(`書き出せませんでした: ${r.error}`)
    else
      toast({
        msg: `${r.files.join('、')} を書き出しました`,
        action: { label: 'フォルダを開く', run: () => window.api.revealSession() }
      })
  }

  return (
    <Dialog title="証跡を書き出す" onClose={onClose}>
      <form
        method="dialog"
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          run()
        }}
      >
        {FORMATS.map((f) => (
          <label key={f.id} className="check">
            <input
              type="checkbox"
              checked={sel.has(f.id)}
              onChange={(e) => {
                const n = new Set(sel)
                if (e.target.checked) n.add(f.id)
                else n.delete(f.id)
                setSel(n)
              }}
            />
            <span>
              {f.label}
              <small className="note-s"> {f.note}</small>
            </span>
          </label>
        ))}
        <div className="actions">
          <button type="button" onClick={onClose} disabled={busy}>
            キャンセル
          </button>
          <button type="submit" className="primary" disabled={busy || sel.size === 0}>
            {busy ? '書き出し中…' : '書き出す'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
