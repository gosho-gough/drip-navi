# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

ハンドドリップの注湯ナビ（React 18 + TypeScript + Vite 5。バックエンドなし）。仕様の正は `README.md`、モックで確定した見た目と挙動は `docs/design-handoff.md`。この2つと食い違う変更をしない。

## コマンド

```bash
npm run dev           # 開発サーバー（host: true、実機から見られる）
npm run check         # typecheck → lint → format:check → test。完了と言う前に必ず通す
npm run test          # vitest run（1回実行）
npx vitest run src/recipes.test.ts            # 1ファイルだけ
npx vitest run -t "境界は左閉右開"             # テスト名で絞る
npm run lint          # oxlint（設定は .oxlintrc.json）
npm run format        # prettier --write（*.md / *.css / index.html は対象外）
npm run build         # tsc && vite build
```

`.claude/hooks/post-edit-check.sh` が、`src/` 配下の ts/tsx を編集するたびに oxlint・prettier・tsc を回し、失敗を返す。返ってきたら次の作業の前に直す。

## 構成

画面は `App.tsx` の状態 `setup → nav → done` の3つで、ルーターは使わない。`App` が `recipeId`・`cups` を持ち、`calc()` の結果（`plan`）を `Setup` と `Navigate` に渡す。

- `recipes.ts`: レシピのデータと `calc(recipe, cups)`、`fmt(sec)`。各工程は「総湯量に対する割合」で持ち、杯数に応じて累計 ml を出す。端数は累計で丸めて差を取るので、工程の合計は必ず総湯量に一致する。**レシピ追加はデータの追加だけで済ませる**（`recipes.test.ts` の不変条件が自動で検査する）。
- `feedback.ts`: 音（Web Audio）・バイブ・Wake Lock。モジュール内に状態を持つ。音は開始ボタンのタップ時に `initAudio()` で初期化する（iOS の自動再生制限）。iOS はバイブ非対応なので音を主、バイブは補助。
- `Navigate.tsx`: タイマー、工程の判定、合図、円形ダイヤル。

## 変えないこと

- タイマーは `setInterval` のカウントではなく、開始時刻との差で経過時間を求める。
- ダイヤルのリングは `key={idx}` で工程ごとに作り直す（外すと 100%→0% の巻き戻りアニメが出る。`Navigate.test.tsx` が検出する）。仕様は `docs/design-handoff.md` 4.2 節。「尾が前向きに消える」演出は復活させない。
- 「注ぐ」と「待つ」は文言と背景色の両方で区別する。「今回 +○ml」と「累計 ○mlまで」は両方表示する。
- ボタン文言は「抽出をはじめる」「一時停止」「再開」「中止」。デザイントークンの値と数字の `tabular-nums` も変えない。
- 確認用の再生速度（×5 / ×10）はモック専用。本実装では削除する。

## テストの書き方

- 時間に依存するテストは `vi.useFakeTimers()` を使い、**100ms ずつ `act` で進める**。まとめて進めると React の描画が1回にまとまり、途中の合図（warn など）が発火しない。
- 音・バイブ・Wake Lock は `vi.mock('./feedback')` か `window` / `navigator` のスタブで差し替える。
- `tsconfig` の `lib` は ES2020。`Array.prototype.at` など ES2022 以降の API はテストでも使えない（`tsc` が落ちる）。
- 本実装で直す予定の点は `docs/design-handoff.md` 6節。直したら対応するテスト（`feedback.test.ts` の `it.todo` など）を実テストにする。

## リント設定の例外

`.oxlintrc.json` で `react/purity`・`jsx-a11y/prefer-tag-over-role`・`jsx-a11y/control-has-associated-label` を外している。`react/purity` は `Navigate.tsx` の `useRef(performance.now())` に反応するもので、`useBrew` への抽出時に有効へ戻す。
