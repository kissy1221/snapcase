import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import diff from 'highlight.js/lib/languages/diff'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

hljs.registerLanguage('sql', sql)
hljs.registerLanguage('json', json)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('python', python)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('diff', diff)
// ログ: 時刻・レベル(ERROR / WARN / INFO)・引用符・数値に色を付ける。
hljs.registerLanguage('log', () => ({
  contains: [
    { className: 'comment', begin: /\b\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?/ },
    { className: 'deletion', begin: /\b(?:ERROR|FATAL|SEVERE|CRITICAL|Exception)\b/ },
    { className: 'attr', begin: /\b(?:WARN|WARNING)\b/ },
    { className: 'keyword', begin: /\b(?:INFO|DEBUG|TRACE)\b/ },
    { className: 'string', begin: /"[^"\n]*"|'[^'\n]*'/ },
    { className: 'number', begin: /\b\d+(?:\.\d+)?\b/ }
  ]
}))

/** コードを色付けした HTML にする。未対応の言語(text / csv など)は、エスケープだけして返す。
 *  戻り値は highlight.js がエスケープ済みの HTML なので、そのまま埋め込める。 */
export function highlight(text: string, lang: string): string {
  if (!hljs.getLanguage(lang)) return escapeHtml(text)
  return hljs.highlight(text, { language: lang, ignoreIllegals: true }).value
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
