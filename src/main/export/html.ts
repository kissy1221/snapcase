import { BANNER_LEVELS } from '../../shared/constants'
import type { Block, Result } from '../../shared/types'
import type { Doc } from './model'

const esc = (s: string): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const BADGE: Record<Result, string> = { OK: 'b-ok', NG: 'b-ng', 保留: 'b-hold', 未実施: 'b-none' }
const CAT_COLOR: Record<string, string> = {
  正常系: '#1565c0',
  準正常系: '#00838f',
  準異常系: '#ef6c00',
  異常系: '#c62828',
  境界値: '#6a1b9a'
}
const catBadge = (c: string): string =>
  c ? `<span class="cat" style="color:${CAT_COLOR[c] ?? '#5f6b7a'}">${esc(c)}</span>` : ''
const bannerLabel = (l: string): string => BANNER_LEVELS.find(([k]) => k === l)?.[1] ?? ''

function block(d: Doc, b: Block, seq: number): string {
  switch (b.type) {
    case 'image': {
      const png = b.image ? d.readImage(b.image) : null
      return [
        b.title ? `<div class="kv"><b>Window:</b> ${esc(b.title)}</div>` : '',
        b.url ? `<div class="kv"><b>URL:</b> <a href="${esc(b.url)}">${esc(b.url)}</a></div>` : '',
        `<img src="data:image/png;base64,${png ? png.toString('base64') : ''}" alt="No.${seq}">`
      ].join('')
    }
    case 'code':
      return `<div class="blk code">${b.label ? `<div class="blk-label">${esc(b.label)}</div>` : ''}<pre>${esc(b.text)}</pre></div>`
    case 'table':
      return `<div class="blk">${b.label ? `<div class="blk-label">${esc(b.label)}</div>` : ''}<table class="dtable">${
        b.columns.length
          ? `<thead><tr>${b.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>`
          : ''
      }<tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
    case 'note':
      return `<div class="note">${esc(b.text).replace(/\n/g, '<br>')}</div>`
    case 'expect':
      return `<div class="blk"><div class="blk-label">期待結果 / 実際結果${
        b.verdict ? ` <span class="badge ${BADGE[b.verdict]}">${b.verdict}</span>` : ''
      }</div><table class="exp"><tr><th>期待結果</th><td>${esc(b.expected)}</td></tr><tr><th>実際の結果</th><td>${esc(b.actual)}</td></tr></table></div>`
    case 'banner':
      return `<div class="banner ban-${b.level}"><b>${esc(bannerLabel(b.level))}</b> ${esc(b.text)}</div>`
    case 'link':
      return `<div class="blk"><div class="blk-label">参照</div><ul class="links">${b.links
        .map((l) => `<li><a href="${esc(l.url)}">${esc(l.label || l.url)}</a></li>`)
        .join('')}</ul></div>`
  }
}

const CSS = `
:root{color-scheme:light}
body{font-family:'BIZ UDPGothic','Hiragino Sans','Yu Gothic UI','Meiryo',sans-serif;margin:24px;color:#1c2230;background:#f3f4f6;line-height:1.7}
h1{font-size:22px;margin:0 0 4px} .meta{color:#586174;font-size:13px;margin-bottom:14px}
.toc,.sessmeta,.tc{background:#fff;border:1px solid #e2e5ea;border-radius:8px}
.toc{padding:12px 16px;margin:12px 0 22px} .toc h2{font-size:15px;margin:0 0 8px}
.toc table{border-collapse:collapse;width:100%;font-size:13px}
.toc th,.toc td{border-bottom:1px solid #eef0f3;padding:5px 8px;text-align:left} .toc td.n{text-align:right;color:#586174;width:64px}
.toc tr.gtr td{background:#f3f4f6;font-weight:bold;color:#374151}
.sessmeta{padding:8px 16px;margin:12px 0 18px;border-collapse:collapse;font-size:13px}
.sessmeta th{text-align:left;color:#586174;white-space:nowrap;padding:4px 14px 4px 0;vertical-align:top} .sessmeta td{padding:4px 0;white-space:pre-wrap}
.grp{font-size:16px;color:#374151;border-left:4px solid #2c4bb8;padding-left:10px;margin:28px 0 6px}
.tc{padding:14px 18px;margin:14px 0} .tc h2{font-size:17px;margin:0 0 8px;border-bottom:2px solid #eef0f3;padding-bottom:6px}
.tcmeta{font-size:13px;margin:6px 0 10px;border-collapse:collapse} .tcmeta th{text-align:left;color:#586174;vertical-align:top;padding:3px 10px 3px 0;white-space:nowrap} .tcmeta td{padding:3px 0;white-space:pre-wrap}
.shot{border:1px solid #e2e5ea;border-radius:6px;padding:12px 14px;margin:12px 0;background:#fcfcfd}
.shot h3{font-size:14px;margin:0 0 6px} .cmt{font-size:14px;margin:6px 0;white-space:pre-wrap}
.kv{font-size:12px;color:#586174;margin:2px 0;word-break:break-all} .kv b{color:#1c2230}
.blk{margin:10px 0} .blk-label{font-size:12px;font-weight:bold;color:#586174;margin:0 0 3px}
.code pre{background:#f3f4f6;border:1px solid #e2e5ea;padding:10px 12px;border-radius:6px;margin:0;overflow-x:auto;font-family:'BIZ UDGothic','Consolas','Menlo',monospace;font-size:12.5px;line-height:1.5;white-space:pre-wrap}
.dtable,.exp{border-collapse:collapse;font-size:12.5px;margin:2px 0}
.dtable th,.dtable td,.exp th,.exp td{border:1px solid #ccd0d8;padding:3px 9px;text-align:left;white-space:pre-wrap;vertical-align:top}
.dtable th,.exp th{background:#eef1f6;color:#374151}
.note{font-size:13px;margin:8px 0}
.banner{font-size:13px;padding:8px 12px;border-radius:6px;margin:8px 0;border-left:5px solid}
.ban-ok{background:#eaf6ee;border-color:#1f8a5b}.ban-ng{background:#fdecea;border-color:#d2372f}.ban-warn{background:#fff6e5;border-color:#c98a12}.ban-info{background:#e9edfa;border-color:#2c4bb8}
.links{margin:4px 0;padding-left:20px;font-size:13px}
img{max-width:100%;border:1px solid #ccd0d8;margin-top:8px;border-radius:4px}
a{color:#2c4bb8;text-decoration:none}
.badge{display:inline-block;font-size:12px;font-weight:bold;padding:1px 9px;border-radius:10px;color:#fff;vertical-align:middle}
.b-ok{background:#1f8a5b}.b-ng{background:#d2372f}.b-hold{background:#c98a12}.b-none{background:#9aa0a6}
.cat{display:inline-block;font-size:11px;font-weight:bold;padding:0 7px;border-radius:4px;border:1.5px solid currentColor;vertical-align:middle;margin-left:6px}
.top{font-size:12px}
@media print{
  @page{size:A4;margin:16mm 12mm}
  body{margin:0;background:#fff} a{color:#000}
  .tc{border:0;padding:0;break-inside:auto}
  .shot,.blk,.exp,.dtable,.banner,.note,.toc,.sessmeta{break-inside:avoid}
  h1,h2,h3{break-after:avoid}
  img{max-width:100%;max-height:150mm}
  .top{display:none}
}`

export function renderHtml(d: Doc): string {
  const tcCount = d.groups.reduce((n, g) => n + g.tcs.length, 0)
  const h: string[] = [
    `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><title>テスト証跡: ${esc(d.name)}</title><style>${CSS}</style></head><body><a id="top"></a>`,
    `<h1>テスト証跡: ${esc(d.name)}</h1>`,
    `<div class="meta">生成: ${d.generated} ／ テストケース ${tcCount}件 ／ 証跡 ${d.entryCount}件</div>`
  ]
  if (d.meta.length)
    h.push(
      `<table class="sessmeta">${d.meta.map(([l, v]) => `<tr><th>${esc(l)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`
    )
  h.push(
    '<div class="toc"><h2>テストケース一覧（目次）</h2><table><tr><th>ID</th><th>項目名</th><th>分類</th><th>判定</th><th class="n">証跡</th></tr>'
  )
  for (const g of d.groups) {
    h.push(`<tr class="gtr"><td colspan="5">${esc(g.name)}</td></tr>`)
    for (const { tc, anchor } of g.tcs)
      h.push(
        `<tr><td><a href="#${anchor}">${esc(tc.id)}</a></td><td>${esc(tc.title)}</td><td>${catBadge(tc.category)}</td><td><span class="badge ${BADGE[tc.result]}">${tc.result}</span></td><td class="n">${tc.entries.length}</td></tr>`
      )
  }
  h.push('</table></div>')
  for (const g of d.groups) {
    h.push(`<h2 class="grp">${esc(g.name)}</h2>`)
    for (const { tc, anchor, entries } of g.tcs) {
      h.push(
        `<section class="tc" id="${anchor}"><h2>${esc(tc.id)} ： ${esc(tc.title)} <span class="badge ${BADGE[tc.result]}">${tc.result}</span>${catBadge(tc.category)}</h2>`
      )
      const rows = (
        [
          ['precondition', '前提条件'],
          ['steps', '手順'],
          ['expected', '期待結果'],
          ['note', '備考']
        ] as const
      )
        .filter(([k]) => tc[k])
        .map(([k, l]) => `<tr><th>${l}</th><td>${esc(tc[k])}</td></tr>`)
        .join('')
      if (rows) h.push(`<table class="tcmeta">${rows}</table>`)
      for (const { e, seq } of entries) {
        h.push(
          `<div class="shot"><h3>No.${seq} <span style="color:#8b93a4;font-weight:normal">${esc(e.time)}</span></h3>`
        )
        if (e.comment) h.push(`<div class="cmt">${esc(e.comment)}</div>`)
        for (const b of e.blocks) h.push(block(d, b, seq))
        h.push('</div>')
      }
      h.push('<div class="top"><a href="#top">▲ 目次へ戻る</a></div></section>')
    }
  }
  h.push('</body></html>')
  return h.join('\n')
}
