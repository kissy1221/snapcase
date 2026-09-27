import { readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import type { ExportFormat } from '../../shared/api'
import type { Session } from '../session'
import { renderHtml } from './html'
import { renderMarkdown } from './md'
import { buildDoc } from './model'
import { renderPdf } from './pdf'
import { renderXlsx } from './xlsx'

const FILE: Record<ExportFormat, string> = {
  html: 'log.html',
  md: 'log.md',
  pdf: 'log.pdf',
  xlsx: 'log.xlsx'
}

const docOf = (s: Session): ReturnType<typeof buildDoc> =>
  buildDoc(s.manifest, (name) => {
    try {
      return readFileSync(join(s.imageDir, name))
    } catch {
      return null
    }
  })

/** 指定の形式でセッションフォルダに書き出し、作ったファイル名を返す。PDF は HTML を元にするので HTML も更新する。 */
export async function exportSession(s: Session, formats: ExportFormat[]): Promise<string[]> {
  const doc = docOf(s)
  const want = new Set(formats)
  if (want.has('pdf')) want.add('html')
  const out: string[] = []
  const write = async (f: ExportFormat, data: string | Buffer): Promise<void> => {
    await writeFile(join(s.dir, FILE[f]), data)
    out.push(FILE[f])
  }
  if (want.has('html')) await write('html', renderHtml(doc))
  if (want.has('md')) await write('md', renderMarkdown(doc))
  if (want.has('xlsx')) await write('xlsx', await renderXlsx(doc))
  if (want.has('pdf')) await write('pdf', await renderPdf(join(s.dir, FILE.html)))
  return out
}

// 変更のたびに log.html / log.md を作り直す(旧版と同じ)。画像の埋め込みが重いので少し待ってまとめる。
const timers = new WeakMap<Session, NodeJS.Timeout>()
export function scheduleLiveOutputs(s: Session): void {
  clearTimeout(timers.get(s))
  timers.set(
    s,
    setTimeout(() => exportSession(s, ['html', 'md']).catch(() => {}), 1500)
  )
}
