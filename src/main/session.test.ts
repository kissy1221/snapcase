import { mkdtemp, mkdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, describe, expect, it } from 'vitest'
import { listSessions, renameSession, sanitizeName, Session } from './session'

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
    expect(again.manifest.testcases[0]).toMatchObject({
      id: 'TC-001',
      title: 'ログイン',
      result: 'NG'
    })
  })

  it('画像を持つ記録を消してもファイルは残り(元に戻せる)、後始末で初めて消える', async () => {
    const s = await Session.open(root, 's')
    await s.apply({ t: 'addTestCase', tc: { id: 'A' } })
    await writeFile(join(s.imageDir, '0001.png'), 'x')
    await writeFile(join(s.imageDir, 'memo.txt'), 'x')
    await s.apply({
      t: 'addEntry',
      tcId: 'A',
      blocks: [{ type: 'image', image: '0001.png', title: '', url: '' }]
    })
    await s.apply({ t: 'deleteEntry', tcId: 'A', no: 1 })
    expect(existsSync(join(s.imageDir, '0001.png'))).toBe(true)
    expect(await s.undo()).toBe(true) // 削除を取り消すと、画像も参照される
    expect(s.manifest.testcases[0].entries).toHaveLength(1)
    await s.collectGarbage()
    expect(existsSync(join(s.imageDir, '0001.png'))).toBe(true) // 参照中は消さない
    await s.apply({ t: 'deleteEntry', tcId: 'A', no: 1 })
    await s.collectGarbage()
    expect(existsSync(join(s.imageDir, '0001.png'))).toBe(false)
    expect(existsSync(join(s.imageDir, 'memo.txt'))).toBe(true) // 画像以外は触らない
  })

  it('undo / redo: 何段でも戻せて、新しい操作をすると redo は捨てられる。保存もされる', async () => {
    const s = await Session.open(root, 'h')
    expect(await s.undo()).toBe(false)
    await s.apply({ t: 'addTestCase', tc: { id: 'A' } })
    await s.apply({ t: 'addTestCase', tc: { id: 'B' } })
    await s.undo()
    expect(s.manifest.testcases.map((t) => t.id)).toEqual(['A'])
    expect((await Session.open(root, 'h')).manifest.testcases.map((t) => t.id)).toEqual(['A']) // 戻した状態が保存される
    await s.redo()
    expect(s.manifest.testcases.map((t) => t.id)).toEqual(['A', 'B'])
    await s.undo()
    await s.apply({ t: 'addTestCase', tc: { id: 'C' } })
    expect(await s.redo()).toBe(false)
    expect(s.manifest.testcases.map((t) => t.id)).toEqual(['A', 'C'])
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

  it('新規作成では実施情報の既定値(実施者・実施日・OS)が入る', async () => {
    const s = await Session.open(root, 'meta')
    expect(s.manifest.meta.tester).toBeTruthy()
    expect(s.manifest.meta.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(s.manifest.meta.os).toBeTruthy()
  })

  it('空のセッション名は拒否する', async () => {
    await expect(Session.open(root, '  ')).rejects.toThrow()
  })
})

describe('listSessions', () => {
  it('更新の新しい順に、判定ごとの件数つきで返す。manifest の無いフォルダは無視する', async () => {
    const a = await Session.open(root, 'old')
    await a.apply({ t: 'addTestCase', tc: { result: 'OK' } })
    await new Promise((r) => setTimeout(r, 60))
    const b = await Session.open(root, 'new')
    await b.apply({ t: 'addTestCase', tc: { result: 'NG' } })
    await mkdir(join(root, 'not-a-session'))
    const list = await listSessions(root)
    expect(list.map((x) => x.name)).toEqual(['new', 'old'])
    expect(list[0]).toMatchObject({ total: 1, counts: { NG: 1, OK: 0 }, entries: 0 })
  })
})

describe('renameSession', () => {
  it('フォルダ名と manifest の session を揃えて変える。開き直しても新しい名前のまま', async () => {
    const s = await Session.open(root, 'before')
    await s.apply({ t: 'addTestCase', tc: { title: 'ログイン' } })
    expect(await renameSession(root, 'before', 'after')).toEqual({ name: 'after' })
    expect(existsSync(join(root, 'before'))).toBe(false)
    const raw = JSON.parse(await readFile(join(root, 'after', 'manifest.json'), 'utf-8'))
    expect(raw.session).toBe('after')
    const again = await Session.open(root, 'after')
    expect(again.manifest.session).toBe('after')
    expect(again.manifest.testcases[0].title).toBe('ログイン')
  })

  it('既存の名前と重なるときは何も変えない。空の名前も断る', async () => {
    await Session.open(root, 'a')
    await Session.open(root, 'b')
    expect(await renameSession(root, 'a', 'b')).toHaveProperty('error')
    expect(await renameSession(root, 'a', '  ')).toHaveProperty('error')
    expect((await listSessions(root)).map((x) => x.name).sort()).toEqual(['a', 'b'])
  })
})
