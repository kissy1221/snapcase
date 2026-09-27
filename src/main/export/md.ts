import { BANNER_LEVELS } from '../../shared/constants'
import type { Block } from '../../shared/types'
import type { Doc } from './model'

const bannerLabel = (l: string): string => BANNER_LEVELS.find(([k]) => k === l)?.[1] ?? ''
const oneLine = (s: string): string => s.replace(/\n/g, ' ')

function block(b: Block, seq: number): string[] {
  switch (b.type) {
    case 'image':
      return [
        ...(b.title ? [`- Window: ${b.title}`] : []),
        ...(b.url ? [`- URL: ${b.url}`] : []),
        '',
        `![No.${seq}](images/${b.image})`,
        ''
      ]
    case 'code':
      return [...(b.label ? [`**${b.label}**`] : []), '```' + b.lang, b.text, '```', '']
    case 'table': {
      const cols = b.columns.length ? b.columns : b.rows[0] ? b.rows[0].map(() => '') : []
      return [
        ...(b.label ? [`**${b.label}**`] : []),
        ...(cols.length
          ? [`| ${cols.join(' | ')} |`, `|${cols.map(() => ' --- ').join('|')}|`]
          : []),
        ...b.rows.map((r) => `| ${r.map(oneLine).join(' | ')} |`),
        ''
      ]
    }
    case 'note':
      return [b.text, '']
    case 'expect':
      return [
        ...(b.expected ? [`- **期待結果:** ${oneLine(b.expected)}`] : []),
        ...(b.actual
          ? [`- **実際の結果:** ${oneLine(b.actual)}${b.verdict ? `\u3000［${b.verdict}］` : ''}`]
          : []),
        ''
      ]
    case 'banner':
      return [`> **[${bannerLabel(b.level)}]** ${b.text}`, '']
    case 'link':
      return ['**参照:**', ...b.links.map((l) => `- [${l.label || l.url}](${l.url})`), '']
  }
}

export function renderMarkdown(d: Doc): string {
  const out = [
    `# テスト証跡: ${d.name}`,
    '',
    `生成: ${d.generated} ／ テストケース ${d.groups.reduce((n, g) => n + g.tcs.length, 0)}件 ／ 証跡 ${d.entryCount}件`,
    ''
  ]
  if (d.meta.length)
    out.push(
      '## 実施情報',
      '',
      ...d.meta.map(([l, v]) => `- **${l}:** ${v.replace(/\n/g, '  \n    ')}`),
      ''
    )
  out.push('## 目次', '')
  for (const g of d.groups) {
    out.push(`- **${g.name}**`)
    for (const { tc, anchor } of g.tcs)
      out.push(
        `  - [${tc.id} ${tc.title}${tc.category ? `〔${tc.category}〕` : ''}（${tc.result}）](#${anchor})`
      )
  }
  out.push('')
  for (const g of d.groups) {
    out.push(`## ${g.name}`, '')
    for (const { tc, anchor, entries } of g.tcs) {
      out.push(
        `<a id="${anchor}"></a>`,
        `### ${tc.id} ： ${tc.title} ${tc.category ? `〔${tc.category}〕` : ''}［${tc.result}］`,
        ''
      )
      for (const [k, label] of [
        ['precondition', '前提条件'],
        ['steps', '手順'],
        ['expected', '期待結果'],
        ['note', '備考']
      ] as const)
        if (tc[k]) out.push(`- **${label}:** ${tc[k].replace(/\n/g, '  \n    ')}`)
      out.push('')
      for (const { e, seq } of entries) {
        out.push(`#### No.${seq}  ${e.time}`, '')
        if (e.comment) out.push(`**操作/確認:** ${e.comment}`, '')
        for (const b of e.blocks) out.push(...block(b, seq))
        out.push('')
      }
    }
  }
  return out.join('\n')
}
