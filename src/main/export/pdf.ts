import { BrowserWindow } from 'electron'

/** HTML ファイルを PDF にする(Electron 内蔵の印刷。Edge/Chrome は不要)。 */
export async function renderPdf(htmlPath: string): Promise<Buffer> {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } })
  try {
    await w.loadFile(htmlPath)
    return await w.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      // ページ番号だけを右下に。日付・URL(file://…)は出さない。
      headerTemplate: '<span></span>',
      footerTemplate:
        '<div style="width:100%;font-size:9px;color:#666;text-align:right;padding:0 12mm"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      generateTaggedPDF: true, // しおり(アウトライン)の元になる構造
      generateDocumentOutline: true // 見出し(フォルダ/テストケース)から「しおり」を作る
    })
  } finally {
    w.destroy()
  }
}
