# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # 開発サーバー起動
pnpm build        # サーバーレンダリングビルド（通常は未使用）
pnpm generate     # スタティックサイト生成（Vercelデプロイ用）
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

`app/composables/useOsmPoints.ts` が Overpass API からのフェッチ・キャッシュ・名前解決を担う共通実装。各フィーチャー種別のコンポーザブルはクエリとキャッシュキーだけを渡す薄いラッパー。

| コンポーザブル | OSMタグ | キャッシュキー | 要素種別 | 色 |
|---|---|---|---|---|
| `useLighthouses` | `man_made=lighthouse` | `lighthouses_japan` | node のみ | オレンジ `#f97316` |
| `useCastles` | `historic=castle` | `castles_japan` | node / way / relation | 青 `#3b82f6` |
| `useDams` | `waterway=dam` | `dams_japan` | node / way / relation | 緑 `#10b981` |

- キャッシュは `localStorage` に7日間保持する（キャッシュキーにはバージョンサフィックスを付ける。クエリやフィルタを変更したらサフィックスを上げて旧キャッシュを無効化する）
- ラベルは `name:ja` → `name` → デフォルト名の優先順で決定する
- way / relation は `out center` で中心座標を取得する（座標が得られない要素は除外）
- **名称フィルタ**: デフォルト名（"灯台"/"城"/"ダム"）と一致する要素は除外する（`useOsmPoints.ts` のフィルタで処理）
- **地理フィルタ**: `area["ISO3166-1"="JP"]["admin_level"="2"]` を Overpass クエリに含めることで日本の行政境界内に限定し、韓国・北朝鮮・ロシアのデータを除外する
- 新しい種別を追加するには `useOsmPoints` にクエリとキャッシュキーを渡すラッパーを作るだけでよい

`MapView.vue` では `Promise.all` で全データを並列フェッチし、`VectorLayer` をレイヤーごとに独立して管理する。右上のチェックボックスの変更は `watch` → `layer.setVisible()` で即時反映する。

### スタイリング

TailwindCSS v4を使用。`@tailwindcss/vite` プラグインを `nuxt.config.ts` の `vite.plugins` に登録しており、`app/assets/css/main.css`（`@import "tailwindcss"` のみ）をエントリーポイントとしてグローバルに読み込む。v4はコンテンツ対象ファイルの自動検出のため `tailwind.config` ファイルは不要。

### テスト

テストファイルは `tests/` ディレクトリに配置する。`vitest.config.ts` で `environment: "nuxt"` を指定しており、`mountSuspended`（`@nuxt/test-utils/runtime`）を使ってNuxtコンテキスト付きでコンポーネントをマウントできる。

### デプロイ

`vercel.json` で `pnpm generate` をビルドコマンドとして指定しており、`.output/public` をスタティックファイルとしてVercelに配信する。

## Coding Conventions

- インデントはタブ、文字列はダブルクォート（Biome設定に従う）
- Biomeの推奨ルールを適用。コード変更後は `pnpm lint` でチェックすること
- Vueコンポーネントは `<script setup lang="ts">` を使用
- Nuxt Auto-importsが有効なため `ref`、`onMounted`、`useHead` 等は明示的にimport不要
