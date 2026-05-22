# my-map

日本の灯台・城・ダムをOpenStreetMapデータで地図上に表示するSPAです。名称で検索してポイントをハイライト表示できます。

## 技術スタック

- [Nuxt 4](https://nuxt.com/) (ssr: false)
- [OpenLayers](https://openlayers.org/) — 地図レンダリング
- [TailwindCSS v4](https://tailwindcss.com/)
- [Vitest](https://vitest.dev/) — テスト
- [Biome](https://biomejs.dev/) — Lint / Format
- [Vercel](https://vercel.com/) — デプロイ

## セットアップ

```bash
pnpm install
```

## 開発

```bash
pnpm dev:fetch   # OSMデータ取得 → http://localhost:3000（初回・データ更新時）
pnpm dev         # http://localhost:3000（データ取得済みの場合）
```

## コマンド一覧

```bash
pnpm dev          # 開発サーバー起動
pnpm dev:fetch    # OSMデータ取得 → 開発サーバー起動
pnpm fetch-osm    # OSMデータ取得のみ（public/data/*.geojson を生成）
pnpm generate     # OSMデータ取得 → スタティックサイト生成
pnpm preview      # generate したビルドをプレビュー
pnpm lint         # Biome で lint・フォーマットチェック
pnpm lint:fix     # Biome で自動修正
pnpm test         # Vitest を watch モードで起動
pnpm test:run     # Vitest を1回だけ実行（CI用）
```

## データについて

`pnpm fetch-osm`（または `pnpm generate`）実行時に [Overpass API](https://overpass-api.de/) から日本国内のデータを取得し、`public/data/` にGeoJSON形式で保存します。

| ファイル | OSMタグ |
|---|---|
| `lighthouses.geojson` | `man_made=lighthouse` |
| `castles.geojson` | `historic=castle`、`historic=ruins` + `ruins=castle` |
| `dams.geojson` | `waterway=dam` |

`public/data/` は `.gitignore` 対象のため、クローン後は必ず `pnpm dev:fetch` または `pnpm fetch-osm` を実行してください。

## デプロイ

Vercel にプッシュすると `pnpm generate` が自動実行され、スタティックサイトとして配信されます。
