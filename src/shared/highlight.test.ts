import { expect, it } from 'vitest'
import { highlight } from './highlight'

it('言語ごとにトークンが色分けされる', () => {
  expect(highlight("SELECT a FROM t WHERE b = 'x';", 'sql')).toContain(
    '<span class="hljs-keyword">SELECT</span>'
  )
  expect(highlight('{"a": 1, "b": "x"}', 'json')).toContain('hljs-attr')
  expect(highlight('2026-01-02 03:04:05 ERROR boom "x" 42', 'log')).toMatch(/hljs-deletion">ERROR/)
  expect(highlight('+added\n-removed', 'diff')).toContain('hljs-addition')
})

it('未対応の言語はそのまま出し、HTML はエスケープする(スクリプトが実行されない)', () => {
  expect(highlight('a <b> & "c"', 'text')).toBe('a &lt;b&gt; &amp; &quot;c&quot;')
  expect(highlight('<script>alert(1)</script>', 'html')).not.toContain('<script>')
  expect(highlight('<img src=x onerror=alert(1)>', 'nosuchlang')).not.toContain('<img')
})
