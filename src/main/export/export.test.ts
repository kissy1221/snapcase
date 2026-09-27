import ExcelJS from 'exceljs'
import { deflateSync } from 'zlib'
import { describe, expect, it } from 'vitest'
import { apply, emptyManifest, type Op } from '../../shared/ops'
import type { Block, Manifest } from '../../shared/types'
import { renderHtml } from './html'
import { renderMarkdown } from './md'
import { buildDoc } from './model'
import { pngSize, renderXlsx } from './xlsx'

/** 幅 w・高さ h の単色 PNG(外部ライブラリなしで作る最小の PNG)。 */
function png(w: number, h: number): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (b: Buffer): number => {
    let c = 0xffffffff
    for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const body = Buffer.concat([Buffer.from(type), data])
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const sum = Buffer.alloc(4)
    sum.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, sum])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // 8bit
  ihdr[9] = 2 // RGB
  const raw = Buffer.alloc((w * 3 + 1) * h, 0x80)
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0 // フィルタ無し
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const blocks: Block[] = [
  {
    type: 'image',
    image: '0001.png',
    title: 'ログイン - Chrome',
    url: 'https://x.example/login?a=1&b=2'
  },
  {
    type: 'code',
    label: '実行SQL',
    lang: 'sql',
    text: "SELECT * FROM t WHERE a < 1 AND b = '<x>';"
  },
  { type: 'table', label: '結果', header: true, columns: ['email', 'n'], rows: [['a@x.jp', '0']] },
  { type: 'note', text: '補足\n2行目' },
  { type: 'expect', expected: 'ロックされる', actual: 'されない', verdict: 'NG' },
  { type: 'banner', level: 'ng', text: '不具合あり' },
  { type: 'link', links: [{ label: '#482', url: 'https://t.example/482' }] }
]

function sample(): Manifest {
  const ops: Op[] = [
    { t: 'setMeta', meta: { tester: '山田', build: 'v1.2' } },
    { t: 'addTestCase', tc: { id: 'B', title: '後のフォルダ', group: '会員', result: 'OK' } },
    {
      t: 'addTestCase',
      tc: {
        id: 'A',
        title: '<b>誤PW</b>',
        group: 'ログイン',
        category: '異常系',
        result: 'NG',
        steps: '1. 開く'
      }
    },
    {
      t: 'addEntry',
      tcId: 'B',
      comment: '会員側',
      blocks: [{ type: 'note', text: 'n' }],
      time: '2026-01-01 10:00:00'
    },
    { t: 'addEntry', tcId: 'A', comment: '誤入力', blocks, time: '2026-01-01 10:01:00' }
  ]
  return ops.reduce((m, op) => apply(m, op).manifest, emptyManifest('会員登録'))
}
const doc = (): ReturnType<typeof buildDoc> =>
  buildDoc(sample(), (n) => (n === '0001.png' ? png(40, 20) : null), new Date(2026, 0, 2, 3, 4, 5))

describe('buildDoc', () => {
  it('フォルダは初出順、通し番号はフォルダ順・テストケース順で欠番なく振る', () => {
    const d = doc()
    expect(d.groups.map((g) => g.name)).toEqual(['会員', 'ログイン'])
    expect(d.groups.flatMap((g) => g.tcs.flatMap((t) => t.entries.map((e) => e.seq)))).toEqual([
      1, 2
    ])
    expect(d.generated).toBe('2026-01-02 03:04:05')
    expect(d.meta).toEqual([
      ['実施者', '山田'],
      ['対象ビルド / 版数', 'v1.2']
    ])
  })
})

describe('HTML', () => {
  const html = renderHtml(doc())
  it('目次からテストケースへのリンク・判定バッジ・分類バッジが出る', () => {
    expect(html).toContain('<a href="#tc1">B</a>')
    expect(html).toContain('<a href="#tc2">A</a>')
    expect(html).toContain('id="tc2"')
    expect(html).toContain('b-ng')
    expect(html).toContain('異常系')
  })
  it('画像は base64 で埋め込み、7種のブロックがすべて出る', () => {
    expect(html).toContain('data:image/png;base64,iVBOR')
    for (const s of [
      '実行SQL',
      '<th>email</th>',
      '補足<br>2行目',
      '期待結果 / 実際結果',
      'ban-ng',
      '#482'
    ])
      expect(html).toContain(s)
  })
  it('コードは言語に応じて色付けされる', () => {
    expect(html).toContain('<span class="hljs-keyword">SELECT</span>')
  })
  it('利用者の入力は HTML エスケープされる', () => {
    expect(html).toContain('&lt;b&gt;誤PW&lt;/b&gt;')
    expect(html).not.toContain('<b>誤PW</b>')
    expect(html).toContain('a=1&amp;b=2')
    expect(html).toContain('&lt;')
    expect(html).not.toContain("'<x>'")
  })
})

describe('Markdown', () => {
  const md = renderMarkdown(doc())
  it('見出し・目次・ブロックが出る', () => {
    expect(md).toContain('## 実施情報')
    expect(md).toContain('- **実施者:** 山田')
    expect(md).toContain('[A <b>誤PW</b>〔異常系〕（NG）](#tc2)')
    expect(md).toContain('#### No.2  2026-01-01 10:01:00')
    expect(md).toContain('![No.2](images/0001.png)')
    expect(md).toContain('```sql')
    expect(md).toContain('| email | n |')
    expect(md).toContain('> **[不具合]** 不具合あり')
    expect(md).toContain('- [#482](https://t.example/482)')
  })
})

describe('Excel', () => {
  it('実施情報・テストケース・各ブロックの文字と、画像が埋め込まれる', async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load((await renderXlsx(doc())) as unknown as ExcelJS.Buffer)
    const ws = wb.getWorksheet('テスト結果')!
    const texts: string[] = []
    ws.eachRow((row) => row.eachCell((c) => texts.push(String(c.value))))
    for (const s of [
      '実施者',
      '山田',
      '■ ログイン',
      'A ： <b>誤PW</b>　［異常系］',
      '判定: NG',
      'SELECT',
      'email',
      '実際の結果',
      'されない　［NG］'
    ])
      expect(
        texts.some((t) => t.includes(s)),
        s
      ).toBe(true)
    expect(ws.getImages()).toHaveLength(1)
  })
  it('pngSize は IHDR から幅・高さを読む', () => {
    expect(pngSize(png(123, 45))).toEqual({ w: 123, h: 45 })
  })
})
