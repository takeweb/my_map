# my-map

日本の灯台・城・ダムをOpenStreetMapデータで地図上に表示するSPAです。

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

OSMデータをビルド時に取得してから開発サーバーを起動します。

```bash
pnpm fetch-osm   # public/data/*.json を生成
pnpm dev         # http://localhost:3000
```

## コマンド一覧

```bash
pnpm fetch-osm    # OSMデータ取得（public/data/*.json を生成）
pnpm dev          # 開発サーバー起動
pnpm generate     # OSMデータ取得 → スタティックサイト生成
pnpm preview      # generate したビルドをプレビュー
pnpm lint         # Biome で lint・フォーマットチェック
pnpm lint:fix     # Biome で自動修正
pnpm test         # Vitest を watch モードで起動
pnpm test:run     # Vitest を1回だけ実行（CI用）
```

## データについて

`pnpm fetch`（または `pnpm generate`）実行時に [Overpass API](https://overpass-api.de/) から日本国内のデータを取得し、`public/data/` に保存します。

| ファイル | OSMタグ |
|---|---|
| `lighthouses.json` | `man_made=lighthouse` |
| `castles.json` | `historic=castle` |
| `dams.json` | `waterway=dam` |

`public/data/` は `.gitignore` 対象のため、クローン後は必ず `pnpm fetch-osm` を実行してください。

## デプロイ

Vercel にプッシュすると `pnpm generate` が自動実行され、スタティックサイトとして配信されます。
