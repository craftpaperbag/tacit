# Tacit

状況の「雰囲気」と「自己主張の度合い」を、最小の認知負荷で記録・蓄積する汎用ライフログ PWA。

- **X 軸（雰囲気）**: 0 = 悪い 〜 100 = 良い
- **Y 軸（主張）**: 0 = 抑制・我慢 〜 100 = 主張・発信

グラフ上の 1 点をタップ → 任意のメモ → 保存。データは端末内の LocalStorage にのみ保存され、JSON でエクスポートできます。

## データ構造

```json
[
  { "id": "1718501234567", "timestamp": "2026-06-16T01:30:00Z", "x": 80, "y": 20, "note": "任意のテキスト" }
]
```

## ローカルで動かす

Service Worker を有効にするため、`file://` ではなく HTTP で配信してください。

```bash
python3 -m http.server 8000
# → http://localhost:8000
```

## GitHub Pages へデプロイ

1. このリポジトリを push
2. Settings → Pages → Branch を `main` / `(root)` に設定
3. `https://<user>.github.io/<repo>/` で公開

すべてのパスは相対参照（`./`）のため、サブディレクトリ配信でもそのまま動作します。

## 構成

| ファイル | 役割 |
|---|---|
| `index.html` | 単一画面のマークアップ |
| `style.css` | oklch ベースのスレートブルー・ミニマル UI |
| `app.js` | 入力・保存・履歴・エクスポート・SW 登録 |
| `manifest.json` / `sw.js` | PWA（インストール・オフライン対応） |
| `icons/` | アプリアイコン（SVG） |
