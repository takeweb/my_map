# my-map

日本の灯台・城・ダムをOpenStreetMapデータで地図上に表示するSPAです。名称で検索してポイントをハイライト表示できます。

`/mlb` では MLB 全30球団のホーム球場を球団ロゴのピンで表示します（アメリカ合衆国の州境界レイヤー付き。州にマウスを乗せると州名を表示。リーグ別・地区別の切り替え、球場アイコンのクリックでチーム名・球団ロゴ・球場名・都市名をポップアップ表示）。

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
pnpm fetch-us-states  # アメリカ合衆国の州境界データを取得（public/data/us-states.geojson を生成）
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

`public/data/` はGit管理対象です。データを更新する場合はローカルで `pnpm fetch-osm` を実行してコミット・プッシュしてください。

### アメリカ合衆国の州境界データ

`pnpm fetch-us-states` で [Natural Earth](https://www.naturalearthdata.com/)（パブリックドメイン）の 1:50m 州境界から50州とコロンビア特別区を取り出し、`public/data/us-states.geojson` に保存します。州境界はほぼ変わらないため、`pnpm generate` には含めていません。

### MLB 球場データ

`app/data/mlbStadiums.json` に手動で管理しています（OSM からは取得しません）。球場名・座標は [MLB Stats API](https://statsapi.mlb.com/api/v1/teams?sportId=1&season=2026&hydrate=venue(location)) の2026年シーズン情報と照合済みです。球団ロゴは `https://www.mlbstatic.com/team-logos/{チームID}.svg` を参照しています。

## デプロイ

Vercel にプッシュすると `nuxt generate` が自動実行され、スタティックサイトとして配信されます。データ取得はローカルで行い、`public/data/` をコミット・プッシュすることでデプロイに反映されます。
