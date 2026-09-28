// 注釈の描画。座標はすべて元画像のピクセル。画面表示と書き出し(焼き込み)で同じ関数を使う。

export type Item =
  | { k: 'rect'; x: number; y: number; w: number; h: number; color: string; lw: number }
  | { k: 'arrow'; x0: number; y0: number; x1: number; y1: number; color: string; lw: number }
  | {
      k: 'callout'
      /** しっぽの先 */
      tx: number
      ty: number
      /** 吹き出しの左上 */
      x: number
      y: number
      text: string
      color: string
      fs: number
    }
  | { k: 'text'; x: number; y: number; text: string; color: string; fs: number }
  | { k: 'mask'; x: number; y: number; w: number; h: number }
  | { k: 'mosaic'; x: number; y: number; w: number; h: number }

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const COLORS = ['#e5484d', '#f5b400', '#3b82f6', '#22a06b']

export type Thickness = 'thin' | 'std' | 'thick'
export const THICKNESSES: { id: Thickness; label: string }[] = [
  { id: 'thin', label: '細' },
  { id: 'std', label: '標準' },
  { id: 'thick', label: '太' }
]
const THICKNESS_SCALE: Record<Thickness, number> = { thin: 0.6, std: 1, thick: 1.6 }

const FONT = '"IBM Plex Sans JP", "Hiragino Sans", "Yu Gothic UI", sans-serif'
const PAD = 0.5 // 文字の余白(文字サイズの倍率)

/** 画像の大きさに応じた線幅・文字サイズ。thickness で太さ調整の倍率をかける。 */
export const sizes = (imgW: number, thickness: Thickness = 'std'): { lw: number; fs: number } => {
  const scale = THICKNESS_SCALE[thickness]
  return {
    lw: Math.max(1, Math.round(Math.max(3, Math.round(imgW / 400)) * scale)),
    fs: Math.max(10, Math.round(Math.max(16, Math.round(imgW / 70)) * scale))
  }
}

function textBox(
  ctx: CanvasRenderingContext2D,
  text: string,
  fs: number
): { w: number; h: number; lines: string[] } {
  ctx.font = `600 ${fs}px ${FONT}`
  const lines = text.split('\n')
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width))
  return { w: w + fs * PAD * 2, h: lines.length * fs * 1.35 + fs * PAD * 2, lines }
}

/** 文字の描画(背景は不透明な白。画像に重なっても読める)。(x, y) は左上。 */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  fs: number,
  border: boolean
): { w: number; h: number } {
  const b = textBox(ctx, text, fs)
  ctx.fillStyle = '#fff'
  ctx.fillRect(x, y, b.w, b.h)
  if (border) {
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(2, fs / 8)
    ctx.strokeRect(x, y, b.w, b.h)
  }
  ctx.fillStyle = color
  ctx.textBaseline = 'top'
  b.lines.forEach((l, i) => ctx.fillText(l, x + fs * PAD, y + fs * PAD + i * fs * 1.35))
  return b
}

/** 矢印の先端の「くの字」。(x0, y0) → (x1, y1) の向きに合わせる。 */
function arrowHead(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  lw: number
): void {
  const angle = Math.atan2(y1 - y0, x1 - x0)
  const len = lw * 4
  const spread = Math.PI / 7
  ctx.beginPath()
  ctx.moveTo(x1 - len * Math.cos(angle - spread), y1 - len * Math.sin(angle - spread))
  ctx.lineTo(x1, y1)
  ctx.lineTo(x1 - len * Math.cos(angle + spread), y1 - len * Math.sin(angle + spread))
  ctx.stroke()
}

/** 矢印の描画。ライブプレビューと本描画の両方から呼ぶ。 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: string,
  lw: number
): void {
  ctx.strokeStyle = color
  ctx.lineWidth = lw
  ctx.beginPath()
  ctx.moveTo(x0, y0)
  ctx.lineTo(x1, y1)
  ctx.stroke()
  arrowHead(ctx, x0, y0, x1, y1, lw)
}

const MOSAIC_BLOCK = 14 // 元の文字が読み取れない粗さ(画像ピクセル基準)

/** 指定範囲を粗いブロックに置き換える(モザイク)。ぼかしと違い、元の値は復元できない。 */
export function pixelate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  view: Rect
): void {
  const cx = Math.max(0, Math.round(x - view.x))
  const cy = Math.max(0, Math.round(y - view.y))
  const cw = Math.min(Math.round(w), ctx.canvas.width - cx)
  const ch = Math.min(Math.round(h), ctx.canvas.height - cy)
  if (cw <= 0 || ch <= 0) return
  const bw = Math.max(1, Math.round(cw / MOSAIC_BLOCK))
  const bh = Math.max(1, Math.round(ch / MOSAIC_BLOCK))
  const tmp = document.createElement('canvas')
  tmp.width = bw
  tmp.height = bh
  tmp.getContext('2d')!.drawImage(ctx.canvas, cx, cy, cw, ch, 0, 0, bw, bh)
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tmp, 0, 0, bw, bh, cx, cy, cw, ch)
  ctx.restore()
}

export function drawItem(ctx: CanvasRenderingContext2D, it: Item, view: Rect): void {
  switch (it.k) {
    case 'rect':
      ctx.strokeStyle = it.color
      ctx.lineWidth = it.lw
      ctx.strokeRect(it.x, it.y, it.w, it.h)
      break
    case 'arrow':
      drawArrow(ctx, it.x0, it.y0, it.x1, it.y1, it.color, it.lw)
      break
    case 'mask':
      ctx.fillStyle = '#000'
      ctx.fillRect(it.x, it.y, it.w, it.h)
      break
    case 'mosaic':
      pixelate(ctx, it.x, it.y, it.w, it.h, view)
      break
    case 'text':
      drawLabel(ctx, it.x, it.y, it.text, it.color, it.fs, false)
      break
    case 'callout': {
      const b = textBox(ctx, it.text, it.fs)
      // しっぽ: 先端 (tx, ty) に一番近い辺の中央から、三角形で伸ばす。
      const cx = it.x + b.w / 2
      const cy = it.y + b.h / 2
      const dx = it.tx - cx
      const dy = it.ty - cy
      const horizontal = Math.abs(dx) / b.w > Math.abs(dy) / b.h
      const half = it.fs * 0.5
      ctx.fillStyle = it.color
      ctx.beginPath()
      if (horizontal) {
        const ex = dx < 0 ? it.x : it.x + b.w
        ctx.moveTo(ex, cy - half)
        ctx.lineTo(ex, cy + half)
      } else {
        const ey = dy < 0 ? it.y : it.y + b.h
        ctx.moveTo(cx - half, ey)
        ctx.lineTo(cx + half, ey)
      }
      ctx.lineTo(it.tx, it.ty)
      ctx.closePath()
      ctx.fill()
      drawLabel(ctx, it.x, it.y, it.text, it.color, it.fs, true)
      break
    }
  }
}

/** 画像・注釈・(あれば)切り抜きの枠を描く。表示用。 */
export function render(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  items: Item[],
  view: Rect
): void {
  ctx.save()
  ctx.translate(-view.x, -view.y)
  ctx.drawImage(img, 0, 0)
  items.forEach((it) => drawItem(ctx, it, view))
  ctx.restore()
}

/** 注釈と切り抜きを画像に焼き込んで PNG にする。黒塗りは元の値ごと失われる。 */
export async function bake(
  img: HTMLImageElement,
  items: Item[],
  crop: Rect | null
): Promise<ArrayBuffer> {
  const c = document.createElement('canvas')
  const view = crop ?? { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }
  c.width = view.w
  c.height = view.h
  render(c.getContext('2d')!, img, items, view)
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
  if (!blob) throw new Error('画像を書き出せませんでした')
  return blob.arrayBuffer()
}
