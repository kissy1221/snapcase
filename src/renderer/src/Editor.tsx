import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EditorItem } from '../../shared/api'
import {
  COLORS,
  THICKNESSES,
  bake,
  render,
  sizes,
  type Item,
  type Rect,
  type Thickness
} from './annotate'
import './assets/editor.css'

type Tool = 'rect' | 'callout' | 'text' | 'mask' | 'crop'
const TOOLS: { id: Tool; label: string; key: string; hint: string }[] = [
  { id: 'rect', label: '枠', key: 'R', hint: 'ドラッグして枠を描く' },
  {
    id: 'callout',
    label: '吹き出し',
    key: 'C',
    hint: '指したい場所からドラッグ。離した位置に文字を入れる'
  },
  { id: 'text', label: '文字', key: 'T', hint: '文字を置きたい場所をクリック' },
  {
    id: 'mask',
    label: '黒塗り',
    key: 'M',
    hint: '隠したい範囲をドラッグ。保存した画像に焼き込まれ、元の値は残りません'
  },
  {
    id: 'crop',
    label: '切り抜き',
    key: 'X',
    hint: '残したい範囲をドラッグ。もう一度ドラッグすると、さらに絞れます'
  }
]

interface Doc {
  items: Item[]
  crop: Rect | null
}
type Draft = { tool: Tool; x0: number; y0: number; x1: number; y1: number }
type Input = { kind: 'callout' | 'text'; x: number; y: number; tx: number; ty: number }

const THICKNESS_KEY = 'ed-thickness'
const savedThickness = (): Thickness => {
  const v = localStorage.getItem(THICKNESS_KEY)
  return v === 'thin' || v === 'thick' ? v : 'std'
}

const norm = (d: Draft): Rect => ({
  x: Math.min(d.x0, d.x1),
  y: Math.min(d.y0, d.y1),
  w: Math.abs(d.x1 - d.x0),
  h: Math.abs(d.y1 - d.y0)
})

export default function Editor(): React.JSX.Element {
  const [item, setItem] = useState<EditorItem | null>(null)
  const [seq, setSeq] = useState(0) // 画像が切り替わるたびに増やし、中の状態を作り直す
  useEffect(() => {
    window.api.editor.current().then(setItem)
    return window.api.editor.onChange((i) => {
      setItem(i)
      setSeq((n) => n + 1)
    })
  }, [])
  if (!item) return <div className="ed" />
  return <EditorBody key={seq} item={item} />
}

function EditorBody({ item }: { item: EditorItem }): React.JSX.Element {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [doc, setDoc] = useState<Doc>({ items: [], crop: null })
  const [past, setPast] = useState<Doc[]>([])
  const [tool, setTool] = useState<Tool>('rect')
  const [color, setColor] = useState(COLORS[0])
  const [thickness, setThicknessState] = useState<Thickness>(savedThickness)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [input, setInput] = useState<Input | null>(null)
  const [comment, setComment] = useState('')
  const [tcId, setTcId] = useState(item.tcId)
  const [busy, setBusy] = useState(false)
  const [cssScale, setCssScale] = useState(1) // 画面上の表示倍率(元画像の1pxが何CSSpxか)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const url = URL.createObjectURL(new Blob([item.bytes], { type: item.mime }))
    const el = new Image()
    el.src = url
    el.decode().then(() => setImg(el))
    return () => URL.revokeObjectURL(url)
  }, [item])

  const view: Rect = useMemo(
    () => doc.crop ?? { x: 0, y: 0, w: img?.naturalWidth ?? 1, h: img?.naturalHeight ?? 1 },
    [doc.crop, img]
  )
  const sz = sizes(img?.naturalWidth ?? 1000, thickness)
  const setThickness = (t: Thickness): void => {
    setThicknessState(t)
    localStorage.setItem(THICKNESS_KEY, t)
  }

  const commit = useCallback(
    (next: Doc) => {
      setPast((p) => [...p, doc])
      setDoc(next)
    },
    [doc]
  )
  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p
      setDoc(p[p.length - 1])
      return p.slice(0, -1)
    })
  }, [])

  // 表示倍率。文字入力欄を、描く位置・大きさに合わせるために使う。
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const ro = new ResizeObserver(() =>
      setCssScale(c.getBoundingClientRect().width / (view.w || 1))
    )
    ro.observe(c)
    return () => ro.disconnect()
  }, [view.w])

  // ---- 描画 ----
  useEffect(() => {
    const c = canvas.current
    if (!c || !img) return
    c.width = view.w
    c.height = view.h
    const ctx = c.getContext('2d')!
    render(ctx, img, doc.items, view)
    if (!draft) return
    const r = norm(draft)
    ctx.save()
    ctx.translate(-view.x, -view.y)
    if (draft.tool === 'rect') {
      ctx.strokeStyle = color
      ctx.lineWidth = sz.lw
      ctx.strokeRect(r.x, r.y, r.w, r.h)
    } else if (draft.tool === 'mask') {
      ctx.fillStyle = 'rgba(0,0,0,.6)'
      ctx.fillRect(r.x, r.y, r.w, r.h)
    } else if (draft.tool === 'crop') {
      ctx.fillStyle = 'rgba(0,0,0,.55)'
      ctx.beginPath()
      ctx.rect(view.x, view.y, view.w, view.h)
      ctx.rect(r.x, r.y, r.w, r.h)
      ctx.fill('evenodd')
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = sz.lw / 2
      ctx.strokeRect(r.x, r.y, r.w, r.h)
    } else if (draft.tool === 'callout') {
      ctx.strokeStyle = color
      ctx.lineWidth = sz.lw
      ctx.beginPath()
      ctx.moveTo(draft.x0, draft.y0)
      ctx.lineTo(draft.x1, draft.y1)
      ctx.stroke()
    }
    ctx.restore()
  }, [img, doc, draft, view, color, sz.lw])

  // ---- 操作 ----
  /** 画面上の位置 → 元画像の座標 */
  const point = (e: React.PointerEvent): { x: number; y: number } => {
    const r = canvas.current!.getBoundingClientRect()
    return {
      x: view.x + ((e.clientX - r.left) * view.w) / r.width,
      y: view.y + ((e.clientY - r.top) * view.h) / r.height
    }
  }
  const onDown = (e: React.PointerEvent): void => {
    if (input || !img) return
    const p = point(e)
    if (tool === 'text') return setInput({ kind: 'text', x: p.x, y: p.y, tx: 0, ty: 0 })
    e.currentTarget.setPointerCapture(e.pointerId)
    setDraft({ tool, x0: p.x, y0: p.y, x1: p.x, y1: p.y })
  }
  const onMove = (e: React.PointerEvent): void => {
    if (!draft) return
    const p = point(e)
    setDraft({ ...draft, x1: p.x, y1: p.y })
  }
  const onUp = (): void => {
    if (!draft) return
    const r = norm(draft)
    setDraft(null)
    const big = r.w > 4 && r.h > 4
    if (draft.tool === 'rect' && big)
      commit({ ...doc, items: [...doc.items, { k: 'rect', ...r, color, lw: sz.lw }] })
    if (draft.tool === 'mask' && big) commit({ ...doc, items: [...doc.items, { k: 'mask', ...r }] })
    if (draft.tool === 'crop' && big)
      commit({
        ...doc,
        crop: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }
      })
    if (draft.tool === 'callout')
      setInput({ kind: 'callout', x: draft.x1, y: draft.y1, tx: draft.x0, ty: draft.y0 })
  }

  const submitText = (text: string): void => {
    const t = text.trim()
    if (t && input)
      commit({
        ...doc,
        items: [
          ...doc.items,
          input.kind === 'text'
            ? { k: 'text', x: input.x, y: input.y, text: t, color, fs: sz.fs }
            : {
                k: 'callout',
                tx: input.tx,
                ty: input.ty,
                x: input.x,
                y: input.y,
                text: t,
                color,
                fs: sz.fs
              }
        ]
      })
    setInput(null)
  }

  const save = async (): Promise<void> => {
    if (busy || !img) return
    setBusy(true)
    await window.api.editor.save({ png: await bake(img, doc.items, doc.crop), comment, tcId })
  }
  const discard = (): void => {
    if (!busy) window.api.editor.discard()
  }

  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      const typing = (e.target as HTMLElement).matches('input, textarea, select')
      if (e.key === 'Escape' && !input) return discard()
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !typing) {
        e.preventDefault()
        return undo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') return void save()
      if (typing || input || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Enter') return void save()
      const t = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase())
      if (t) setTool(t.id)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const hint = TOOLS.find((t) => t.id === tool)?.hint

  return (
    <div className="ed">
      <header className="ed-top">
        <label className="dest">
          保存先
          <select value={tcId} onChange={(e) => setTcId(e.target.value)}>
            {item.testcases.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} {t.title}
              </option>
            ))}
          </select>
        </label>
        <div className="tools" role="toolbar" aria-label="注釈ツール">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={tool === t.id ? 'on' : ''}
              aria-pressed={tool === t.id}
              onClick={() => setTool(t.id)}
            >
              {t.label}
              <b>{t.key}</b>
            </button>
          ))}
          <span className="sep" />
          {COLORS.map((c) => (
            <button
              key={c}
              className={'sw' + (color === c ? ' on' : '')}
              style={{ background: c }}
              aria-label={`色 ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
            />
          ))}
          <span className="sep" />
          {THICKNESSES.map((t) => (
            <button
              key={t.id}
              className={thickness === t.id ? 'on' : ''}
              aria-pressed={thickness === t.id}
              onClick={() => setThickness(t.id)}
            >
              {t.label}
            </button>
          ))}
          <span className="sep" />
          <button onClick={undo} disabled={!past.length} aria-label="元に戻す">
            元に戻す
          </button>
          <button onClick={() => commit({ ...doc, items: [] })} disabled={!doc.items.length}>
            全消し
          </button>
          {doc.crop && <button onClick={() => commit({ ...doc, crop: null })}>切り抜き解除</button>}
        </div>
        <div className="ed-actions">
          {item.remaining > 0 && <span className="rest">あと{item.remaining}枚</span>}
          <button onClick={discard}>
            破棄<kbd>Esc</kbd>
          </button>
          <button className="primary" onClick={() => void save()} disabled={busy || !img}>
            保存<kbd>⏎</kbd>
          </button>
        </div>
      </header>

      <div className="canvas">
        <p className="tip">{hint}</p>
        <div className="stage">
          <canvas
            ref={canvas}
            className={tool === 'text' ? 'text-cursor' : ''}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
          />
          {input && (
            <textarea
              className="overlay"
              autoFocus
              rows={1}
              style={{
                left: (input.x - view.x) * cssScale,
                top: (input.y - view.y) * cssScale,
                color,
                fontSize: sz.fs * cssScale
              }}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape') setInput(null)
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  submitText(e.currentTarget.value)
                }
              }}
              onBlur={(e) => submitText(e.currentTarget.value)}
            />
          )}
        </div>
      </div>

      <footer className="ed-bottom">
        <input
          className="comment"
          value={comment}
          placeholder="コメント（操作内容や期待結果。空でも保存できます）"
          aria-label="コメント"
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) void save()
          }}
        />
        <div className="src">
          {item.title && <span>{item.title}</span>}
          {item.url && <span>{item.url}</span>}
        </div>
      </footer>
    </div>
  )
}
