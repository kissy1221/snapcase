import { useState } from 'react'
import { BANNER_LEVELS, CODE_LANGS } from '../../shared/constants'
import { highlight } from '../../shared/highlight'
import { parseTable, tableToText } from '../../shared/parse'
import type { Block } from '../../shared/types'
import { BLOCK_LABEL, type TextBlockType } from './blockMeta'
import { Dialog } from './ui'

export function BlockView({ b }: { b: Block }): React.JSX.Element | null {
  switch (b.type) {
    case 'image':
      return (
        <figure className="shot">
          <img src={`evidence://img/${b.image}`} alt="" title="クリックで拡大" />
          {(b.title || b.url) && (
            <figcaption>
              {b.title && <span>{b.title}</span>}
              {b.url && <span>{b.url}</span>}
            </figcaption>
          )}
        </figure>
      )
    case 'code':
      return (
        <div>
          <div className="blabel">
            {b.label || 'コード'}
            <em>{b.lang}</em>
          </div>
          <pre>
            <code dangerouslySetInnerHTML={{ __html: highlight(b.text, b.lang) }} />
          </pre>
        </div>
      )
    case 'table':
      return (
        <div>
          <div className="blabel">{b.label}</div>
          <div className="scroll">
            <table className="num">
              {b.columns.length > 0 && (
                <thead>
                  <tr>
                    {b.columns.map((c, i) => (
                      <th key={i}>{c}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {b.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j}>{c}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    case 'note':
      return <p className="note">{b.text}</p>
    case 'expect':
      return (
        <div className="expect">
          <div>
            <small>期待結果</small>
            {b.expected}
          </div>
          <div className={b.verdict === 'NG' ? 'ng' : ''}>
            <small>
              実際の結果{b.verdict && <span className={'v ' + b.verdict}>{b.verdict}</span>}
            </small>
            {b.actual}
          </div>
        </div>
      )
    case 'banner':
      return (
        <div className={'banner ' + b.level}>
          <b>{BANNER_LEVELS.find(([k]) => k === b.level)?.[1]}</b> {b.text}
        </div>
      )
    case 'link':
      return (
        <ul className="links">
          {b.links.map((l, i) => (
            <li key={i}>
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.label || l.url}
              </a>
            </li>
          ))}
        </ul>
      )
  }
}

const emptyBlock = (t: TextBlockType): Block => {
  switch (t) {
    case 'code':
      return { type: 'code', label: '', lang: 'sql', text: '' }
    case 'table':
      return { type: 'table', label: '結果', header: true, columns: [], rows: [] }
    case 'note':
      return { type: 'note', text: '' }
    case 'expect':
      return { type: 'expect', expected: '', actual: '', verdict: '' }
    case 'banner':
      return { type: 'banner', level: 'info', text: '' }
    case 'link':
      return { type: 'link', links: [{ label: '', url: '' }] }
  }
}

/** ブロック1つの追加・編集ダイアログ。種類ごとに入力欄を出し分ける。 */
export function BlockDialog({
  type,
  initial,
  onSubmit,
  onClose
}: {
  type: TextBlockType
  initial?: Block
  onSubmit: (b: Block) => void
  onClose: () => void
}): React.JSX.Element {
  const [b, setB] = useState<Block>(initial ?? emptyBlock(type))
  // 表は貼り付けやすいよう、編集中はテキストで持つ。
  const [text, setText] = useState(b.type === 'table' ? tableToText(b.columns, b.rows) : '')
  const patch = (p: Record<string, unknown>): void => setB({ ...b, ...p } as Block)

  /** リンクの i 行目を部分的に書き換える。 */
  const setLink = (i: number, p: { label?: string; url?: string }): void => {
    if (b.type !== 'link') return
    patch({ links: b.links.map((l, j) => (j === i ? { ...l, ...p } : l)) })
  }

  const build = (): Block | null => {
    if (b.type === 'table') {
      const t = parseTable(text, b.header)
      return t.rows.length || t.columns.length ? { ...b, ...t } : null
    }
    if (b.type === 'link') {
      // URL が空の行は捨てる。ラベルは空でもよい(その場合は URL を表示する)。
      const links = b.links
        .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
        .filter((l) => l.url)
      return links.length ? { ...b, links } : null
    }
    if (b.type === 'code') return b.text.trim() ? b : null
    if (b.type === 'note' || b.type === 'banner') return b.text.trim() ? b : null
    if (b.type === 'expect') return b.expected.trim() || b.actual.trim() ? b : null
    return b
  }
  const built = build()

  return (
    <Dialog title={BLOCK_LABEL[type] + (initial ? 'を編集' : 'を追加')} onClose={onClose}>
      <form
        method="dialog"
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (built) onSubmit(built)
        }}
      >
        {(b.type === 'code' || b.type === 'table') && (
          <label>
            ラベル
            <input
              value={b.label}
              onChange={(e) => patch({ label: e.target.value })}
              placeholder={b.type === 'code' ? '例: 実行SQL' : '例: 結果'}
            />
          </label>
        )}
        {b.type === 'code' && (
          <>
            <label>
              言語
              <select value={b.lang} onChange={(e) => patch({ lang: e.target.value })}>
                {CODE_LANGS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </label>
            <label>
              本文
              <textarea
                className="mono"
                rows={9}
                value={b.text}
                onChange={(e) => patch({ text: e.target.value })}
                autoFocus
              />
            </label>
          </>
        )}
        {b.type === 'table' && (
          <>
            <label>
              本文（Excel やクエリ結果をそのまま貼り付け。タブ区切り、カンマ区切りも可）
              <textarea
                className="mono"
                rows={9}
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={b.header}
                onChange={(e) => patch({ header: e.target.checked })}
              />
              1行目を見出しにする
            </label>
          </>
        )}
        {b.type === 'note' && (
          <label>
            本文
            <textarea
              rows={6}
              value={b.text}
              onChange={(e) => patch({ text: e.target.value })}
              autoFocus
            />
          </label>
        )}
        {b.type === 'expect' && (
          <>
            <label>
              期待結果
              <textarea
                rows={3}
                value={b.expected}
                onChange={(e) => patch({ expected: e.target.value })}
                autoFocus
              />
            </label>
            <label>
              実際の結果
              <textarea
                rows={3}
                value={b.actual}
                onChange={(e) => patch({ actual: e.target.value })}
              />
            </label>
            <label>
              判定
              <select value={b.verdict} onChange={(e) => patch({ verdict: e.target.value })}>
                <option value="">（なし）</option>
                <option>OK</option>
                <option>NG</option>
              </select>
            </label>
          </>
        )}
        {b.type === 'banner' && (
          <>
            <label>
              種類
              <select value={b.level} onChange={(e) => patch({ level: e.target.value })}>
                {BANNER_LEVELS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <label>
              一言
              <input value={b.text} onChange={(e) => patch({ text: e.target.value })} autoFocus />
            </label>
          </>
        )}
        {b.type === 'link' && (
          <div className="field">
            <span className="lbl">リンク</span>
            <div className="link-rows">
              {b.links.map((l, i) => (
                <div className="link-row" key={i}>
                  <input
                    aria-label={`ラベル ${i + 1}`}
                    placeholder="ラベル（例: #482 ログイン失敗）"
                    value={l.label}
                    onChange={(e) => setLink(i, { label: e.target.value })}
                    autoFocus={i === 0}
                  />
                  <input
                    aria-label={`URL ${i + 1}`}
                    placeholder="https://…"
                    inputMode="url"
                    value={l.url}
                    onChange={(e) => setLink(i, { url: e.target.value })}
                  />
                  <button
                    type="button"
                    className="x"
                    aria-label={`リンク ${i + 1} を削除`}
                    disabled={b.links.length === 1 && !l.label && !l.url}
                    onClick={() =>
                      patch({
                        links:
                          b.links.length === 1
                            ? [{ label: '', url: '' }]
                            : b.links.filter((_, j) => j !== i)
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="chip"
                onClick={() => patch({ links: [...b.links, { label: '', url: '' }] })}
              >
                ＋ リンクを追加
              </button>
            </div>
          </div>
        )}
        <div className="actions">
          <button type="button" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="primary" disabled={!built}>
            {initial ? '保存' : '追加'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/** 画像の拡大表示。クリックか Esc で閉じる。 */
export function ImageViewer({
  b,
  onClose
}: {
  b: Extract<Block, { type: 'image' }>
  onClose: () => void
}): React.JSX.Element {
  return (
    <Dialog title={b.title || '画像'} onClose={onClose}>
      <button type="button" className="viewer" onClick={onClose} aria-label="閉じる">
        <img src={`evidence://img/${b.image}`} alt="" />
      </button>
    </Dialog>
  )
}
