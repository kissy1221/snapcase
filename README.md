# 証跡作ったったー

手動テストの証跡（スクリーンショット・コード・表・判定）を、テストケースごとに整理して残すデスクトップアプリ。
書き出しは PDF / Excel / HTML / Markdown。Windows と macOS に対応（Linux はベストエフォート）。

旧版（Python / tkinter、Windows 専用）の作り直し。既存のセッション（`manifest.json` v3）はそのまま開ける。
設計と方針は [docs/design.md](docs/design.md)、画面のイメージは [docs/mockup.html](docs/mockup.html)。

## 使い方

1. ホームでセッション名を入力して開始（既存の名前なら続きから）。
2. 「テストケースを追加」するか、CSV / Excel（ファイルのドロップも可）から取り込む。
3. テストする画面を前面にして **Ctrl+Alt+S**（設定で変更可）。編集画面で注釈とコメントを付けて Enter で保存。
   マウスだけなら、画面下の撮影ボタンからウィンドウを選ぶ。
4. 画像は貼り付け（Ctrl/⌘+V）やドロップでも追加できる。コード・表・期待と実際・メモ・バナー・参照リンクも証跡に載せられる。
5. 「書き出す」で PDF などを作る。⌘K / Ctrl+K で、すべての操作をキーボードから呼べる。

ウィンドウを細くするとコンパクト表示になり、「手前に固定」してテストしながら使える。

### macOS の許可

初回の撮影で「画面収録」の許可が必要。開いた設定で本アプリを許可し、アプリを再起動する。

## 開発

```
npm install
npm run dev        # 開発起動
npm test           # vitest
npm run typecheck
npm run lint
npm run build:mac  # / build:win / build:linux（配布物は dist/）
```

保存先は既定で「書類/証跡作ったったー」。自動テストでは環境変数 `EVIDENCE_DATA_DIR` で差し替える。

```
src/shared    manifest の型と更新処理(ops)、取り込みの解析。テストの中心
src/main      セッションの読み書き、撮影、編集画面の待ち行列、書き出し(export/)、IPC
src/preload   contextBridge で公開する window.api
src/renderer  React の画面(ホーム・ワークスペース・編集画面・コンパクト)
```
