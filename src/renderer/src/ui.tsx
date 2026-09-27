import { useEffect, useRef, useState } from 'react'
import { dismissToast, useConfirm, useToast } from './store'

/** ネイティブ <dialog>。Esc で閉じ、フォーカスは中に閉じ込められる。 */
export function Dialog({
  title,
  onClose,
  children
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  return (
    <dialog ref={ref} className="dialog" onClose={onClose} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </dialog>
  )
}

/** 枠なしで書ける複数行入力。内容に合わせて高さが伸び、フォーカスが外れたときに確定する。 */
export function AutoText({
  value,
  onCommit,
  placeholder,
  label
}: {
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  label: string
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null) // 編集中だけ持つ。null なら value を表示
  const ref = useRef<HTMLTextAreaElement>(null)
  const shown = draft ?? value
  useEffect(() => {
    const el = ref.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = el.scrollHeight + 'px'
    }
  }, [shown])
  return (
    <textarea
      ref={ref}
      className="auto"
      rows={1}
      value={shown}
      aria-label={label}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value) onCommit(draft)
        setDraft(null)
      }}
    />
  )
}

/** 1行の入力。Enter か フォーカスが外れたときに確定する。 */
export function AutoLine({
  value,
  onCommit,
  className,
  list,
  placeholder,
  label
}: {
  value: string
  onCommit: (v: string) => void
  className?: string
  list?: string
  placeholder?: string
  label: string
}): React.JSX.Element {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      className={className}
      value={draft ?? value}
      list={list}
      aria-label={label}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft !== value) onCommit(draft)
        setDraft(null)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur()
      }}
    />
  )
}

export function Toaster(): React.JSX.Element | null {
  const t = useToast()
  if (!t) return null
  return (
    <div className="toast" role="status">
      <span>{t.msg}</span>
      {t.action && (
        <button
          onClick={() => {
            t.action?.run()
            dismissToast()
          }}
        >
          {t.action.label}
        </button>
      )}
    </div>
  )
}

/** 確認ダイアログの表示場所(アプリに1つ)。最初にフォーカスが当たるのは「キャンセル」側。 */
export function ConfirmHost(): React.JSX.Element | null {
  const c = useConfirm()
  if (!c) return null
  return (
    <Dialog title={c.title} onClose={() => c.resolve(false)}>
      <p className="confirm-msg">{c.message}</p>
      <div className="actions">
        <button type="button" onClick={() => c.resolve(false)}>
          キャンセル
        </button>
        <button type="button" className="danger" onClick={() => c.resolve(true)}>
          {c.okLabel}
        </button>
      </div>
    </Dialog>
  )
}
