# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm fetch-osm    # OSMデータをビルド時取得（public/data/*.json を生成）
pnpm dev          # 開発サーバー起動（事前に pnpm fetch-osm が必要）
pnpm build        # サーバーレンダリングビルド（通常は未使用）
pnpm generate     # OSMデータ取得 → スタティックサイト生成（Vercelデプロイ用）
pnpm preview      # generateしたビルドをプレビュー
pnpm lint         # Biomeでlint・フォーマットチェック
pnpm lint:fix     # Biomeで自動修正
pnpm format       # Biomeでフォーマットのみ自動修正
pnpm test         # Vitestをwatchモードで起動
pnpm test:run     # Vitestを1回だけ実行（CI用）
```

## Architecture

SPAとして動作する地図アプリ（`ssr: false`）。Nuxt 4のファイルベースルーティングを使用し、全ページコードは `app/` 配下に置く。

### 地図レンダリング

`app/components/MapView.vue` がOpenLayersの唯一のエントリーポイント。`ol/Map` はグローバルの `Map` と名前衝突するため `OlMap` としてインポートする。地図インスタンスは `onMounted` で初期化し、`onUnmounted` で `setTarget(undefined)` を呼んでクリーンアップする。OpenLayersのベースCSSは `nuxt.config.ts` の `css` フィールドでグローバル読み込みしており、コンポーネント内でのimportは不要。

### フィーチャーデータ（灯台・城・ダム）

**ビルド時取得方式**を採用。`scripts/fetch-osm.mjs` が `pnpm generate` の前工程として実行され、`overpass-api.de` から日本国内データを取得して `public/data/*.json` に保存する。ブラウザはこの静的 JSON を GET するだけなので CORS・タイムアウト・ランタイム API 障害の影響を受けない。

`app/composables/useOsmPoints.ts` が静的 JSON のフェッチとキャッシュを担う共通実装。各コンポーザブルは `dataUrl` とキャッシュキーを渡す薄いラッパー。

| コンポーザブル | OSMタグ | データファイル | キャッシュキー | 色 |
|---|---|---|---|---|
| `useLighthouses` | `man_made=lighthouse` | `/data/lighthouses.json` | `lighthouses_jp_v5` | オレンジ `#f97316` |
| `useCastles` | `historic=castle` | `/data/castles.json` | `castles_jp_v6` | 青 `#3b82f6` |
| `useDams` | `waterway=dam` | `/data/dams.json` | `dams_jp_v6` | 緑 `#10b981` |

- キャッシュは `localStorage` に7日間保持する（キャッシュキーにはバージョンサフィックスを付ける。データ形式やフィルタを変更したらサフィックスを上げて旧キャッシュを無効化する）
- **地理フィルタ**: `scripts/fetch-osm.mjs` が `area["ISO3166-1"="JP"]["admin_level"="2"]` で日本の行政境界内に絞る。ビルド時実行なのでタイムアウト制約なし（120秒設定）
- **名称フィルタ**: デフォルト名（"灯台"/"城"/"ダム"）と一致する要素をスクリプト側で除外する
- `public/data/` は `.gitignore` 対象（ビルド時に再生成される）
- 新しい種別を追加するには `scripts/fetch-osm.mjs` に FEATURES エントリを追加し、`useOsmPoints` ラッパーを作るだけでよい

`MapView.vue` では `Promise.all` で全データを並列フェッチし、`VectorLayer` をレイヤーごとに独立して管理する。右上のチェックボックスの変更は `watch` → `layer.setVisible()` で即時反映する。

### スタイリング

TailwindCSS v4を使用。`@tailwindcss/vite` プラグインを `nuxt.config.ts` の `vite.plugins` に登録しており、`app/assets/css/main.css`（`@import "tailwindcss"` のみ）をエントリーポイントとしてグローバルに読み込む。v4はコンテンツ対象ファイルの自動検出のため `tailwind.config` ファイルは不要。

### テスト

テストファイルは `tests/` ディレクトリに配置する。`vitest.config.ts` で `environment: "nuxt"` を指定しており、`mountSuspended`（`@nuxt/test-utils/runtime`）を使ってNuxtコンテキスト付きでコンポーネントをマウントできる。fetch モックは `OsmPoint[]` 配列を直接返す形式（Overpass 形式ではない）。

### デプロイ

`vercel.json` で `pnpm generate`（= OSMデータ取得 + `nuxt generate`）をビルドコマンドとして指定し、`.output/public` をスタティックファイルとして Vercel に配信する。`/:path*` のリライトで SPA ルーティングを有効化。

## Coding Conventions

- インデントはタブ、文字列はダブルクォート（Biome設定に従う）
- Biomeの推奨ルールを適用。コード変更後は `pnpm lint` でチェックすること
- Vueコンポーネントは `<script setup lang="ts">` を使用
- Nuxt Auto-importsが有効なため `ref`、`onMounted`、`useHead` 等は明示的にimport不要
