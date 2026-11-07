# ガードレールとファイル群の説明

本実装で、AI エージェントも人間も「壊したら機械的に止まる」状態で作業するための仕組みをまとめる。
仕様の正は [README.md](../README.md)、モックで確定した見た目と挙動は [design-handoff.md](./design-handoff.md)。このファイルは、それらを守らせる検査の一覧と設定の置き場所を示す。

## 全体像

| 操作 | 走る検査 | 失敗したとき |
| --- | --- | --- |
| `src/` の ts/tsx を Edit / Write する | oxlint、Prettier、tsc（編集直後） | エージェントに出力が返り、次の作業前に直させる |
| `git commit` する | lint、整形、型検査（ステージ済みファイル中心） | コミットが止まる |
| `git push` する | `npm run check`（型・lint・整形・テスト） | push が止まる |
| PR を作る / `main` へ push する | CI で `npm run check` と `npm run build` | PR のチェックが赤になる |
| `npm run check` を手で実行する | 型・lint・整形・テストを順に実行 | 最初に失敗した段階で止まる |
| `npm install` / `npm ci` する | git hooks の登録 | （自動で `lefthook install`） |

下の層ほど遅く、確実に止める。編集時の hook は速い検査だけで、テストは走らない。テストは push 前と CI で走る。

## 1. 編集した直後の検査（Claude Code の hook）

**操作**: Claude Code が `src/` 配下の `.ts` / `.tsx` を Edit または Write したとき。

**検査**:

1. oxlint（`--report-unused-disable-directives` 付き）を、編集したファイルに実行する。
2. `prettier --check` を、編集したファイルに実行する。
3. `tsc --noEmit` を、プロジェクト全体に実行する。

3つの結果をまとめ、1つでも失敗していれば終了コード 2 で出力をエージェントに返す。`src/` 以外のファイル（README、CSS、設定ファイル）は何もせず通す。テストは走らない。

**設定**:

- [.claude/settings.json](../.claude/settings.json): PostToolUse の `Edit|Write` に hook を登録している。タイムアウトは 90 秒。
- [.claude/hooks/post-edit-check.sh](../.claude/hooks/post-edit-check.sh): 上の3つを実行するスクリプト。対象ファイルの判定と、失敗の集約もここにある。

**注意**: Claude Code の Edit / Write でだけ発火する。Bash の `sed` などで書き換えたファイルや、エディタでの手動編集では走らない。その場合は次の層（コミット時）で捕まえる。

## 2. コミット時の検査（pre-commit）

**操作**: `git commit`。

**検査**（3つを並列に実行）:

| 名前 | 内容 | 対象 |
| --- | --- | --- |
| lint | `oxlint --report-unused-disable-directives` | ステージ済みの `*.ts` / `*.tsx` |
| format | `prettier --check` | ステージ済みの `*.ts` / `*.tsx` / `*.json` / `*.yml` |
| typecheck | `npm run typecheck`（`tsc --noEmit`） | プロジェクト全体 |

**設定**:

- [lefthook.yml](../lefthook.yml): pre-commit と pre-push の定義。
- [package.json](../package.json) の `prepare` スクリプト: `npm install` / `npm ci` のたびに `lefthook install` を実行し、`.git/hooks` に登録する。クローン直後でも、依存を入れれば hook が有効になる。

**迂回**: `git commit --no-verify` で飛ばせる。飛ばしても次の push 前と CI で止まる。

## 3. push 前の検査（pre-push）

**操作**: `git push`。

**検査**: `npm run check` を実行する。内訳は下の「`npm run check` の中身」を参照。

**設定**: [lefthook.yml](../lefthook.yml) の `pre-push`。

## 4. CI（GitHub Actions）

**操作**: `main` への push、または PR の作成と更新。

**検査**: `npm ci` のあと、`npm run check`、`npm run build` を順に実行する。Node のバージョンは `.nvmrc` から読む。手元で hook を迂回した変更も、ここで止まる。

**設定**:

- [.github/workflows/ci.yml](../.github/workflows/ci.yml): ワークフロー本体。
- [.nvmrc](../.nvmrc): Node のメジャーバージョン（22）。

**未確認**: 実際の GitHub 上での実行は、まだ一度もしていない。最初の PR で確かめる。

## `npm run check` の中身

`npm run check` は、次の4つをこの順に実行する。最初に失敗した段階で止まる。

| 段階 | コマンド | 何を守るか | 設定 |
| --- | --- | --- | --- |
| 型検査 | `npm run typecheck`（`tsc --noEmit`） | 型の誤り、未使用の変数と引数、配列の添字アクセスが `undefined` になりうる箇所 | [tsconfig.json](../tsconfig.json) |
| lint | `npm run lint`（oxlint） | 正しさの誤り、hooks の規則、a11y、`any` の使用、`console` と `debugger`、効かなくなった抑止コメント | [.oxlintrc.json](../.oxlintrc.json) |
| 整形 | `npm run format:check`（Prettier） | コードの書式。差分のノイズを減らす | [.prettierrc](../.prettierrc)、[.prettierignore](../.prettierignore) |
| テスト | `npm run test`（`vitest run`） | 下の「テストが守っている仕様」 | [vite.config.ts](../vite.config.ts)、[src/test/setup.ts](../src/test/setup.ts) |

スクリプトの定義は [package.json](../package.json) の `scripts`。

### 型検査の厳しさ

[tsconfig.json](../tsconfig.json) の `strict` に加えて、`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`、`noUncheckedIndexedAccess` を有効にしている。`noUncheckedIndexedAccess` のため、`arr[0]` は `undefined` を含む型になる。確実に存在する場合だけ `!` を付ける。`lib` は ES2020 なので、`Array.prototype.at` など ES2022 以降の API は使えない。

### lint の中身

[.oxlintrc.json](../.oxlintrc.json) で次を有効にしている。

- プラグイン: typescript、react、jsx-a11y、vitest。
- カテゴリ: correctness はエラー、suspicious は警告。
- 個別のルール: `react/rules-of-hooks` と `react/exhaustive-deps`（hooks の依存配列）、`typescript/no-explicit-any`、`no-console`、`no-debugger` をエラーにしている。

次のルールは外している。理由と戻す時期を残す。

| 外したルール | 理由 | 戻す時期 |
| --- | --- | --- |
| `react/react-in-jsx-scope` | 新しい JSX 変換（`jsx: react-jsx`）では `React` の import が要らない | 戻さない |
| `react/purity` | [Navigate.tsx](../src/Navigate.tsx) の `useRef(performance.now())` に反応する | `useBrew` への抽出時 |
| `jsx-a11y/prefer-tag-over-role` | `role="status"` を `<output>` に置き換える指摘で、モックで確定した構造を変えるため | 本実装で再検討 |
| `jsx-a11y/control-has-associated-label` | ボタン内の `<strong>` のテキストを認識できない誤検知 | 戻さない |
| `vitest/require-mock-type-parameters` | モックの型引数が冗長になるため | 戻さない |
| `vitest/warn-todo` | 本実装で埋める `it.todo` を許すため | `it.todo` がなくなったら |

**既知の抜け**: [Navigate.tsx](../src/Navigate.tsx) の `// eslint-disable-line` は oxlint でも有効なため、`exhaustive-deps` の指摘が抑止コメントで隠れている。本実装で工程切り替えの検知を関数やフックに分けるときに、コメントごと消す。

### 整形の対象外

[.prettierignore](../.prettierignore) で、`dist`、`node_modules`、`package-lock.json`、`*.md`、`*.css`、`index.html` を外している。文書とモックの CSS を、整形の差分で埋めないため。整形の書式は [.prettierrc](../.prettierrc)（シングルクォート、セミコロンなし、幅 120）。

## テストが守っている仕様

テストは `src/` に置き、[vite.config.ts](../vite.config.ts) の `test` で `src/**/*.test.{ts,tsx}` を対象にしている。環境は jsdom で、[src/test/setup.ts](../src/test/setup.ts) が jest-dom のマッチャを登録し、各テストの後に描画を片付ける。

| ファイル | 守っている仕様 | 壊すと落ちる例 |
| --- | --- | --- |
| [src/recipes.test.ts](../src/recipes.test.ts) | `calc` の計算（最終の累計が総湯量に一致、工程の合計が総湯量に一致、量は 0 以上、累計は単調増加、基本レシピ 2 杯の具体値）、`fmt` の表示、全レシピの不変条件（割合の合計 100、開始秒の昇順と先頭 0、注ぎ切る秒数が工程の長さ以内、`id` と工程名の一意性） | 割合の合計を 100 から外す、丸め方を変える |
| [src/Navigate.test.tsx](../src/Navigate.test.tsx) | 工程の判定（境界は左閉右開、注ぐ / 待つ）、残り秒数、合図（初回は switch を鳴らさない、warn は終了 3 秒前に工程ごと 1 回、done は 1 回）、画面スリープ防止の開始と解除、ダイヤルの進み方と `key={idx}` による作り直し、一時停止と再開、中止の確認 | リングの `key={idx}` を外す |
| [src/App.test.tsx](../src/App.test.tsx) | レシピと杯数の選択で豆量と湯量が更新される、杯数は 1〜4 の 4 択、ボタン文言、設定 → ナビ → 完了 → もう一杯 / 設定に戻る の遷移 | ボタン文言の変更、遷移の誤り |
| [src/feedback.test.ts](../src/feedback.test.ts) | 合図ごとの周波数とバイブのパターン、音・バイブ・Wake Lock が非対応でも例外を出さない、Wake Lock の拒否を握りつぶす | 周波数表の変更、例外の素通し |

`feedback.test.ts` には `it.todo` が 1 件ある。`visibilitychange` での Wake Lock の再取得（[design-handoff.md](./design-handoff.md) 6 節の 1）は本実装で追加するため、実装したら実テストに変える。

### テストの書き方の注意

- 時間に依存するテストは `vi.useFakeTimers()` を使い、**100ms ずつ `act` で進める**。まとめて進めると描画が 1 回にまとまり、途中の合図が発火しない。
- 音・バイブ・Wake Lock は、`vi.mock('./feedback')` か `window` と `navigator` のスタブで差し替える。
- jsdom と Testing Library で確かめられるのは構造と振る舞いまで。色、アニメーションの見た目、実機の音とバイブは確かめられない。UI を変えたら、ブラウザか実機で目視する。

## エージェント向けの文書

| ファイル | 役割 |
| --- | --- |
| [CLAUDE.md](../CLAUDE.md) | Claude Code が最初に読む。コマンド、構成、変えないこと、テストの書き方、lint の例外を書いている |
| [AGENTS.md](../AGENTS.md) | 他のコーディングエージェント向け。`CLAUDE.md` を参照するだけにして、二重管理を避けている |

「変えないこと」の詳細な根拠は [design-handoff.md](./design-handoff.md) にある。CLAUDE.md には要点と参照先だけを書き、内容は複製しない。

## ファイル一覧

| ファイル | 種別 | 説明 |
| --- | --- | --- |
| [package.json](../package.json) | 設定 | スクリプト（`typecheck` `lint` `format` `format:check` `test` `test:watch` `check` `prepare`）と依存 |
| [tsconfig.json](../tsconfig.json) | 設定 | TypeScript の厳しさ |
| [vite.config.ts](../vite.config.ts) | 設定 | ビルドと vitest の設定 |
| [.oxlintrc.json](../.oxlintrc.json) | 設定 | oxlint のプラグイン、カテゴリ、ルール |
| [.prettierrc](../.prettierrc) | 設定 | Prettier の書式 |
| [.prettierignore](../.prettierignore) | 設定 | Prettier の対象外 |
| [.nvmrc](../.nvmrc) | 設定 | Node のバージョン（CI と手元をそろえる） |
| [lefthook.yml](../lefthook.yml) | git hooks | pre-commit と pre-push |
| [.github/workflows/ci.yml](../.github/workflows/ci.yml) | CI | `check` と `build` |
| [.claude/settings.json](../.claude/settings.json) | Claude Code | 編集後の hook の登録 |
| [.claude/hooks/post-edit-check.sh](../.claude/hooks/post-edit-check.sh) | Claude Code | 編集後の検査スクリプト |
| [CLAUDE.md](../CLAUDE.md) / [AGENTS.md](../AGENTS.md) | 文書 | エージェント向けの案内 |
| [src/test/setup.ts](../src/test/setup.ts) | テスト | テスト共通の準備 |
| `src/*.test.ts` / `src/*.test.tsx` | テスト | 上の「テストが守っている仕様」 |

## 新しいことをするときの置き場所

- **レシピを足す**: [src/recipes.ts](../src/recipes.ts) の `recipes` にデータを足すだけ。不変条件のテストが自動で検査する。
- **ルールを足す・外す**: lint は [.oxlintrc.json](../.oxlintrc.json)、型の厳しさは [tsconfig.json](../tsconfig.json)。外すときは、この文書の「外したルール」の表に理由を足す。
- **検査を足す**: `package.json` の `check` に足し、pre-push と CI に自動で反映させる。編集直後の hook に足すのは、速い検査（数秒以内）だけにする。
- **本実装で直す点**: [design-handoff.md](./design-handoff.md) 6 節。直したら、対応するテストを実テストにして、この文書の「既知の抜け」を更新する。
