import { mkdtemp, mkdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, describe, expect, it } from 'vitest'
import { listSessions, sanitizeName, Session } from './session'

let root: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'evidence-'))
})

describe('Session', () => {
  it('新規作成→操作→再オープンで内容が残る。ファイル名に使えない文字は置き換える', async () => {
    expect(sanitizeName(' a/b:c ')).toBe('a_b_c')
    const s = await Session.open(root, 'a/b')
    await s.apply({ t: 'addTestCase', tc: { title: 'ログイン', result: 'NG' } })
    const again = await Session.open(root, 'a/b')
    expect(again.manifest.testcases[0]).toMatchObject({ id: 'TC-001', title: 'ログイン', result: 'NG' })
  })

  it('画像を持つ記録を消すと images/ のファイルも消える', async () => {
    const s = await Session.open(root, 's')
    await s.apply({ t: 'addTestCase', tc: { id: 'A' } })
    await writeFile(join(s.imageDir, '0001.png'), 'x')
    await s.apply({ t: 'addEntry', tcId: 'A', blocks: [{ type: 'image', image: '0001.png', title: '', url: '' }] })
    await s.apply({ t: 'deleteEntry', tcId: 'A', no: 1 })
    expect(existsSync(join(s.imageDir, '0001.png'))).toBe(false)
  })

  it('壊れた manifest は上書きせずエラーにする', async () => {
    await mkdir(join(root, 'bad'))
    await writeFile(join(root, 'bad', 'manifest.json'), '{ not json')
    await expect(Session.open(root, 'bad')).rejects.toThrow()
    expect(await readFile(join(root, 'bad', 'manifest.json'), 'utf-8')).toBe('{ not json')
  })

  it('新規作成した直後から一覧に出る', async () => {
    await Session.open(root, 'fresh')
    expect((await listSessions(root)).map((x) => x.name)).toEqual(['fresh'])
  })

  it('空のセッション名は拒否する', async () => {
    await expect(Session.open(root, '  ')).rejects.toThrow()
  })
})

describe('listSessions', () => {
  it('更新の新しい順に、判定ごとの件数つきで返す。manifest の無いフォルダは無視する', async () => {
    const a = await Session.open(root, 'old')
    await a.apply({ t: 'addTestCase', tc: { result: 'OK' } })
    await new Promise((r) => setTimeout(r, 20))
    const b = await Session.open(root, 'new')
    await b.apply({ t: 'addTestCase', tc: { result: 'NG' } })
    await mkdir(join(root, 'not-a-session'))
    const list = await listSessions(root)
    expect(list.map((x) => x.name)).toEqual(['new', 'old'])
    expect(list[0]).toMatchObject({ total: 1, counts: { NG: 1, OK: 0 }, entries: 0 })
  })
})
