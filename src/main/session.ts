import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from 'fs/promises'
import { platform, release, userInfo } from 'os'
import { join } from 'path'
import { apply, emptyManifest, normalize, type Op } from '../shared/ops'
import type { SessionSummary } from '../shared/api'
import type { Manifest, Meta } from '../shared/types'

/** 実施情報の既定値(実施者・実施日・OS)。ブラウザ・ビルド・備考は空のまま。 */
export function defaultMeta(): Meta {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  const os = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[platform()] ?? platform()
  return {
    tester: userInfo().username,
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    os: `${os} ${release()}`
  }
}

export const sanitizeName = (name: string): string => name.replace(/[\\/:*?"<>|]/g, '_').trim()

export class Session {
  /** 保存のたびに呼ばれる(ログの再生成などに使う)。 */
  onSaved?: () => void

  private constructor(
    readonly dir: string,
    public manifest: Manifest
  ) {}

  get manifestPath(): string {
    return join(this.dir, 'manifest.json')
  }
  get imageDir(): string {
    return join(this.dir, 'images')
  }

  /** 無ければ作り、あれば続きから開く。旧形式の manifest も読める。 */
  static async open(root: string, rawName: string): Promise<Session> {
    const name = sanitizeName(rawName)
    if (!name) throw new Error('セッション名を入力してください')
    const dir = join(root, name)
    await mkdir(join(dir, 'images'), { recursive: true })
    try {
      const raw = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf-8'))
      const opened = new Session(dir, normalize(raw, name))
      await opened.collectGarbage()
      return opened
    } catch (e) {
      // manifest が無い(新規)のは正常。壊れている場合は上書きせず、開けないと伝える。
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT')
        throw new Error('manifest.json を読み込めません')
    }
    // 新規は即保存する。保存しないと、最初の操作までホームの一覧に出ない。
    const s = new Session(dir, { ...emptyManifest(name), meta: defaultMeta() })
    await s.save()
    return s
  }

  private past: Manifest[] = []
  private future: Manifest[] = []

  /** 操作を適用して保存する。元に戻せるよう、直前の状態を覚える(画像ファイルは消さない)。 */
  async apply(op: Op): Promise<void> {
    const r = apply(this.manifest, op)
    this.past.push(this.manifest)
    if (this.past.length > 200) this.past.shift()
    this.future = []
    this.manifest = r.manifest
    await this.save()
  }

  /** 1つ前の状態に戻す。戻せるものが無ければ false。 */
  async undo(): Promise<boolean> {
    const prev = this.past.pop()
    if (!prev) return false
    this.future.push(this.manifest)
    this.manifest = prev
    await this.save()
    return true
  }

  async redo(): Promise<boolean> {
    const next = this.future.pop()
    if (!next) return false
    this.past.push(this.manifest)
    this.manifest = next
    await this.save()
    return true
  }

  /** どの記録からも参照されていない画像(削除した記録など)を消す。元に戻せなくなるので、閉じるとき・開くときだけ行う。 */
  async collectGarbage(): Promise<void> {
    const used = new Set(
      this.manifest.testcases.flatMap((t) =>
        t.entries.flatMap((e) => e.blocks.flatMap((b) => (b.type === 'image' ? [b.image] : [])))
      )
    )
    for (const f of await readdir(this.imageDir).catch(() => [])) {
      if (/^\d+\.png$/.test(f) && !used.has(f)) await unlink(join(this.imageDir, f)).catch(() => {})
    }
  }

  async save(): Promise<void> {
    // 書き込み途中の中断で manifest を壊さないよう、一時ファイル経由で置き換える。
    const tmp = this.manifestPath + '.tmp'
    await writeFile(tmp, JSON.stringify(this.manifest, null, 2), 'utf-8')
    await rename(tmp, this.manifestPath)
    this.onSaved?.()
  }
}

/** 名前を変える。フォルダ名と manifest の session を揃え、同じ名前が既にあれば変えない。 */
export async function renameSession(
  root: string,
  from: string,
  to: string
): Promise<{ error: string } | { name: string }> {
  const name = sanitizeName(to)
  if (!name) return { error: 'セッション名を入力してください' }
  if (name === from) return { name }
  const dirs = await readdir(root, { withFileTypes: true }).catch(() => [])
  if (dirs.some((d) => d.isDirectory() && d.name === name))
    return { error: '同じ名前のセッションがあります' }
  await rename(join(root, from), join(root, name))
  // 保存と同じく、一時ファイル経由で manifest を置き換える。
  const manifestPath = join(root, name, 'manifest.json')
  const raw = JSON.parse(await readFile(manifestPath, 'utf-8'))
  raw.session = name
  const tmp = manifestPath + '.tmp'
  await writeFile(tmp, JSON.stringify(raw, null, 2), 'utf-8')
  await rename(tmp, manifestPath)
  return { name }
}

export async function listSessions(root: string): Promise<SessionSummary[]> {
  await mkdir(root, { recursive: true })
  const out: SessionSummary[] = []
  for (const d of await readdir(root, { withFileTypes: true })) {
    if (!d.isDirectory()) continue
    const path = join(root, d.name, 'manifest.json')
    try {
      const m = normalize(JSON.parse(await readFile(path, 'utf-8')), d.name)
      const counts = { 未実施: 0, OK: 0, NG: 0, 保留: 0 }
      for (const tc of m.testcases) counts[tc.result]++
      out.push({
        name: d.name,
        updatedAt: (await stat(path)).mtimeMs,
        total: m.testcases.length,
        counts,
        entries: m.testcases.reduce((n, tc) => n + tc.entries.length, 0)
      })
    } catch {
      continue // manifest の無いフォルダはセッションではない
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}
