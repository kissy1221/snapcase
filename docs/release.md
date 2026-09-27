# ビルドとリリース

配布は GitHub の Release で行う。ビルドは GitHub Actions が、タグの push をきっかけに Windows / macOS / Linux で行う。

## リリースの手順

1. `main` を最新にして、テストが通っていることを確認する。
2. バージョンを上げて、コミットとタグを作る（`package.json` の version とタグは一致させる）。
   ```
   npm version patch -m "🔖 chore: v%s"     # 0.1.0 → 0.1.1。minor / major や 0.2.0 のような直接指定も可
   git push --follow-tags
   ```
3. GitHub の Actions で `Release` が動く（10〜20 分ほど）。終わると Releases に、ビルド成果物と `SHA256SUMS.txt` が載る。
   タグに `-` を含む（`v1.0.0-beta.1` など）ときは、プレリリースとして載る。

タグと `package.json` の version が食い違うと、最初のジョブで止まる（成果物は作られない）。
失敗したときは、タグを消して（`git push --delete origin v0.1.1` と `git tag -d v0.1.1`）、直してからやり直す。

## 成果物

| OS | ファイル |
|---|---|
| Windows | `evidence-shot-<版>-win-setup.exe`（インストーラ）／ `…-win-portable.exe`（インストール不要） |
| macOS | `evidence-shot-<版>-mac-arm64.dmg`（Apple Silicon）／ `…-mac-x64.dmg`（Intel） |
| Linux | `evidence-shot-<版>-linux-x86_64.AppImage`（X11 向け。Wayland では最前面ウィンドウの撮影ができない） |

## 署名していないことについて

証明書を持っていないため、いまの成果物は署名なし（macOS は ad-hoc 署名）。初回だけ、次の操作が要る。

- **macOS：** 開こうとすると警告が出る。「システム設定 → プライバシーとセキュリティ」の「このまま開く」を押す。
  「壊れている」と出るときは、ターミナルで `xattr -dr com.apple.quarantine /Applications/証跡作ったったー.app` を実行する。
- **Windows：** SmartScreen が出たら「詳細情報 → 実行」を選ぶ。
- **Linux：** `chmod +x evidence-shot-*.AppImage` してから実行する。

社内などで広く配るなら、署名を付けるのがよい。

### 署名を付けるとき

- **macOS：** Apple Developer Program（有料）の「Developer ID Application」証明書が要る。
  リポジトリの Secrets に `CSC_LINK`（証明書 .p12 を base64 にしたもの）、`CSC_KEY_PASSWORD`、公証用の `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID` を登録する。
  `.github/workflows/release.yml` の `-c.mac.identity=-` と `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` を外し、`electron-builder.yml` の `notarize` を `true` にする。
- **Windows：** コード署名証明書（.pfx）を `CSC_LINK` / `CSC_KEY_PASSWORD` に登録する。証明書を持たない場合は、Azure Trusted Signing などのサービスを使う手もある。

## 自動更新

未対応。導入するなら `electron-updater` を使う。macOS は署名が前提なので、署名を付けてから。

## CI

`main` への push と Pull Request で、Windows / macOS / Linux の3つで型チェック・lint・テスト・ビルドを行う（`.github/workflows/ci.yml`）。
開発機は macOS だけなので、Windows / Linux で起きる問題（パス、改行、文字コード）はここで見つける。

## ローカルでビルドする

```
npm run build:mac      # / build:win / build:linux（自分の OS のもの。成果物は dist/）
npm run build:unpack   # 実行ファイルだけ作る(dist/ 内で、そのまま起動して確認できる)
```

Windows 版は、Windows 上でしか作れない（ネイティブモジュールが Windows 用に用意される）。
