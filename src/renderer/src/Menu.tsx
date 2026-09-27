import { useEffect, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  run?: () => void
  danger?: boolean
  disabled?: boolean
  /** 選べない見出し行(グループ分け用) */
  heading?: boolean
}

/** ボタンを押すと開くメニュー。外側のクリック・Esc で閉じ、↑↓ で選べる。画面の下端に近ければ上に開く。 */
export function Menu({
  trigger,
  label,
  items,
  className = ''
}: {
  trigger: React.ReactNode
  label: string
  items: MenuItem[]
  className?: string
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [up, setUp] = useState(false)
  const root = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent): void => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const toggle = (): void => {
    if (!open && root.current)
      setUp(
        window.innerHeight - root.current.getBoundingClientRect().bottom < items.length * 34 + 24
      )
    setOpen(!open)
  }

  const onKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
      root.current?.querySelector('button')?.focus()
    }
    if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      const btns = [
        ...root.current!.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)')
      ]
      const at = btns.indexOf(document.activeElement as HTMLButtonElement)
      btns[(at + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length]?.focus()
    }
  }

  return (
    <span className={'menu ' + className} ref={root} onKeyDown={onKey}>
      <button
        type="button"
        className="menu-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        {trigger}
      </button>
      {open && (
        <div className={'menu-list' + (up ? ' up' : '')} role="menu">
          {items.map((it, i) =>
            it.heading ? (
              <div key={i} className="menu-heading">
                {it.label}
              </div>
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                className={it.danger ? 'danger' : ''}
                disabled={it.disabled}
                autoFocus={i === 0}
                onClick={() => {
                  setOpen(false)
                  it.run?.()
                }}
              >
                {it.label}
              </button>
            )
          )}
        </div>
      )}
    </span>
  )
}
