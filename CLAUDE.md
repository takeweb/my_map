# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm fetch-osm    # OSMデータをビルド時取得（public/data/*.json を生成）
pnpm fetch-states # アメリカ合衆国・カナダの州境界を取得（public/data/us-states.geojson・canada-provinces.geojson を生成）
pnpm fetch-plane-zones # 平面直角座標系の適用区域を生成（public/data/plane-rectangular-zones.geojson）
pnpm dev          # 開発サーバー起動（データ取得済みの場合）
pnpm dev:fetch    # OSMデータ取得 → 開発サーバー起動
pnpm build        # サーバーレンダリングビルド（通常は未使用）
pnpm generate     # OSMデータ取得 → スタティックサイト生成（ローカル確認用）
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

**ビルド時取得方式**を採用。`scripts/fetch-osm.mjs` が `pnpm generate` の前工程として実行され、`overpass-api.de` から日本国内データを取得して `public/data/*.geojson` に保存する。ブラウザはこの静的GeoJSONを GET するだけなので CORS・タイムアウト・ランタイム API 障害の影響を受けない。

`app/composables/useOsmPoints.ts` が静的GeoJSONのフェッチとキャッシュを担う共通実装。各コンポーザブルは `dataUrl` とキャッシュキーを渡す薄いラッパー。`MapView.vue` では `ol/format/GeoJSON` の `readFeatures` でフィーチャーに変換する（`featureProjection: "EPSG:3857"` 指定が必要）。

| コンポーザブル | OSMタグ | データファイル | キャッシュキー | 色 |
|---|---|---|---|---|
| `useLighthouses` | `man_made=lighthouse` | `/data/lighthouses.geojson` | `lighthouses_jp_v10` | オレンジ `#f97316` |
| `useCastles` | `historic=castle` | `/data/castles.geojson` | `castles_jp_v10` | 青 `#3b82f6` |
| `useDams` | `waterway=dam` | `/data/dams.geojson` | `dams_jp_v9` | 緑 `#10b981` |

- キャッシュは `localStorage` に7日間保持する（キャッシュキーにはバージョンサフィックスを付ける。データ形式やフィルタを変更したらサフィックスを上げて旧キャッシュを無効化する）
- **地理フィルタ**: `scripts/fetch-osm.mjs` が `area["ISO3166-1"="JP"]["admin_level"="2"]` で日本の行政境界内に絞る。ビルド時実行なのでタイムアウト制約なし（120秒設定）
- **名称フィルタ**: デフォルト名（"灯台"/"城"/"ダム"）と一致する要素をスクリプト側で除外する
- `public/data/` はGit管理対象。ローカルで `pnpm fetch-osm` を実行してコミット・プッシュする
- 新しい種別を追加するには `scripts/fetch-osm.mjs` に FEATURES エントリを追加し、`useOsmPoints` ラッパーを作るだけでよい

`MapView.vue` では `Promise.all` で全データを並列フェッチし、`VectorLayer` をレイヤーごとに独立して管理する。右上のチェックボックスの変更は `watch` → `layer.setVisible()` で即時反映する。ポイントレイヤーのスタイルは関数形式で、`feature.get("prefecture_code")` が `visiblePrefCodes` に含まれない場合は `[]` を返して非表示にする。都道府県トグル変更時は `lighthouseSource.changed()` / `castleSource.changed()` / `damSource.changed()` を呼んで再描画する。

### 平面直角座標（JGD2000・JGD2011）

`MapView.vue` のレイヤー一覧で「平面直角座標」をオンにすると、選んだ測地系・系（I〜XIX）の X・Y グリッド線と、マウス位置の座標（X: 北方向、Y: 東方向、m）を表示する。系の定義・グリッド計算は `app/utils/planeRectangular.ts` にまとめている。

- 投影法は `proj4` で EPSG:2443〜2461（JGD2000）・EPSG:6669〜6687（JGD2011）を定義し、`ol/proj/proj4` の `register` で OpenLayers に登録する（`registerPlaneRectangularProjections`）
- JGD2000 と JGD2011 は同じ GRS80・同じ原点なので、変換式は同一（違いは地殻変動による緯度経度そのものの改定で、変換パラメータでは表せない）
- グリッドは `moveend` ごとに表示範囲から作り直す。間隔は表示範囲に応じて 100m〜200km から選ぶ。中央子午線から離れると横メルカトルが破綻するため、原点から経緯度 ±20° の範囲に限る
- クリック・カーソル判定は `layerFilter` でポイントレイヤーだけを対象にする（グリッド線でポップアップが開かないように）
- 地図をクリックすると、その位置の X・Y をタブ区切り（小数3桁）でクリップボードにコピーする（`singleclick` で、ダブルクリックのズームでは反応しない。灯台・城・ダムのマーカーの上ではコピーしない）
- 選択中の系の原点（X=0, Y=0）に系名と経緯度付きのマーカーを出す
- 選択中の系の適用区域を赤く塗り、系を切り替えるとその区域と原点が収まるようにズームする（`view.fit`。XI系などは原点が区域外の海上にある）。区域データは `usePlaneRectangularZones` → `/data/plane-rectangular-zones.geojson` で、平面直角座標をオンにしたときに初めて取得する
- 区域データは `scripts/fetch-plane-zones.mjs` が生成する。都道府県単位の系は `prefectures.geojson` を流用し、東京都・沖縄県・鹿児島県は告示の経緯度の線で切り分け、北海道は振興局・市町村の境界を Overpass から取得する。区域は変化しないため `pnpm generate` には含めない（`prefectures.geojson` を更新したら再生成する）

### MLB 球場マップ（`/mlb`）

`app/pages/mlb.vue` → `app/components/MlbMapView.vue`。日本の地図（`MapView.vue`）とは独立した OpenLayers インスタンスを持つ。

- 球場データは `app/data/mlbStadiums.json`（手動管理、OSM 取得の対象外）。型・リーグ/地区の定義・表示フィルタは `app/utils/mlbStadiums.ts` にまとめている
- データ更新時は MLB Stats API（`statsapi.mlb.com/api/v1/teams?sportId=1&season=<年>&hydrate=venue(location)`）と照合する。`id` は同 API のチーム ID で、ロゴ URL（`mlbstatic.com/team-logos/{id}.svg`）にも使う
- アイコンは、リーグ色のピンの中に球団ロゴを入れた SVG を data URI にした `ol/style/Icon`。ロゴ SVG は `fetch` で取得してピンの SVG に埋め込む（画像として読み込む SVG は外部 URL を参照できないため）。取得前・失敗時は野球のダイヤモンドのピンを表示する
- 表示フィルタはスタイル関数で `[]` を返して非表示にし、切り替え時に `source.changed()` と `view.fit()` を呼ぶ
- ポップアップは `ol/Overlay` で球場座標に固定する（地図を動かしても追従する）
- 州境界レイヤーはアメリカ合衆国（藍色、`useUsStates` → `/data/us-states.geojson`）とカナダ（薄紅 `#f0908d`、`useCanadaProvinces` → `/data/canada-provinces.geojson`）の2つ。どちらも共通実装 `useAdminAreas` の薄いラッパーで、コンポーネント側も `createBoundaryLayer` で同じ作りにしている。データは `scripts/fetch-states.mjs` が Natural Earth（1:50m、パブリックドメイン）から生成する。OSM の行政境界は米国全体だと巨大になるため使っていない。州境界は変化しないため `pnpm generate` には含めない
- クリックは `layerFilter` で球場レイヤーだけを対象にする（州のポリゴンでポップアップが開かないように）
- 州にマウスを乗せると、州名（日本語・英語）のツールチップを出し、その州を濃い色で表示する。球場ピンの上では州名を出さない

### スタイリング

TailwindCSS v4を使用。`@tailwindcss/vite` プラグインを `nuxt.config.ts` の `vite.plugins` に登録しており、`app/assets/css/main.css`（`@import "tailwindcss"` のみ）をエントリーポイントとしてグローバルに読み込む。v4はコンテンツ対象ファイルの自動検出のため `tailwind.config` ファイルは不要。

### テスト

テストファイルは `tests/` ディレクトリに配置する。`vitest.config.ts` で `environment: "nuxt"` を指定しており、`mountSuspended`（`@nuxt/test-utils/runtime`）を使ってNuxtコンテキスト付きでコンポーネントをマウントできる。fetch モックは GeoJSON `FeatureCollection` 形式で返す（`{ type: "FeatureCollection", features: [...] }`）。

### デプロイ

`vercel.json` で `pnpm generate`（= OSMデータ取得 + `nuxt generate`）をビルドコマンドとして指定し、`.output/public` をスタティックファイルとして Vercel に配信する。`/:path*` のリライトで SPA ルーティングを有効化。

## Coding Conventions

- インデントはタブ、文字列はダブルクォート（Biome設定に従う）
- Biomeの推奨ルールを適用。コード変更後は `pnpm lint` でチェックすること
- Vueコンポーネントは `<script setup lang="ts">` を使用
- Nuxt Auto-importsが有効なため `ref`、`onMounted`、`useHead` 等は明示的にimport不要
