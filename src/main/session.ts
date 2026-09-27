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
      return new Session(dir, normalize(raw, name))
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

  /** 操作を適用して保存する。参照されなくなった画像は images/ から消す。 */
  async apply(op: Op): Promise<void> {
    const r = apply(this.manifest, op)
    this.manifest = r.manifest
    await this.save()
    await Promise.all(r.removedImages.map((f) => unlink(join(this.imageDir, f)).catch(() => {})))
  }

  async save(): Promise<void> {
    // 書き込み途中の中断で manifest を壊さないよう、一時ファイル経由で置き換える。
    const tmp = this.manifestPath + '.tmp'
    await writeFile(tmp, JSON.stringify(this.manifest, null, 2), 'utf-8')
    await rename(tmp, this.manifestPath)
  }
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
