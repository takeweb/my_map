---
name: OSM データ取得戦略
description: 灯台・城・ダムのデータはビルド時に Overpass API から取得し静的 JSON として配置する
type: project
---

ビルド時取得方式（`scripts/fetch-osm.mjs`）を採用。`pnpm generate` の前工程として実行され、`overpass-api.de` から日本国内データを取得して `public/data/*.json` に保存する。

**Why:** ランタイム CORS・タイムアウト・Vercel Function ルーティング問題を経て、最終的にビルド時取得に落ち着いた。灯台・城・ダムは増減が少なく、ビルド時取得で十分新鮮さを保てる。起動も速くなった。

**How to apply:** 新しい地物種別を追加する際は `scripts/fetch-osm.mjs` の FEATURES 配列にエントリを追加し、`useOsmPoints` ラッパーを作る。データ変更時は `pnpm fetch` で再生成するか、`pnpm generate` でデプロイ時に自動再生成される。クエリやフィルタを変えたらキャッシュキーのバージョン番号を上げること。
