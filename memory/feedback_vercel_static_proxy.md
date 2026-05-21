---
name: Vercel 静的デプロイでのプロキシ
description: ssr:false の静的デプロイでは Vercel Function より静的ファイル配信方式が確実
type: feedback
---

ビルド時に外部 API からデータを取得して静的ファイルとして配置する方式を優先すること。

**Why:** `ssr: false` + `pnpm generate` の静的デプロイでは、Vercel Function（`api/` ディレクトリ）のルーティングが `framework` 設定や `rewrites` と干渉して予測しにくい。実際に CORS・406・ボディパース・area ID など多くの問題が重なった。静的ファイル配信はこれらすべてを回避できる。

**How to apply:** 外部 API から取得したデータを `public/data/*.json` に置き、ブラウザからは GET で取得する。CORS 不要、タイムアウト不要、Vercel Function 不要。データが頻繁に変化する場合のみランタイム取得を検討する。
