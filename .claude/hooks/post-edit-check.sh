#!/bin/bash
# PostToolUse(Edit|Write): 編集された src/ 配下の ts/tsx を検査する。
# 失敗したら exit 2 で出力をエージェントへ返す(次の編集で直させる)。
f=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
[ -z "$f" ] && exit 0
cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" || exit 0
case "$f" in
  */src/*.ts | */src/*.tsx | src/*.ts | src/*.tsx) ;;
  *) exit 0 ;;
esac
[ -f "$f" ] || exit 0

out=""
run() { # run <ラベル> <コマンド...>
  local label=$1 r
  shift
  r=$("$@" 2>&1) || out+="■ ${label} が失敗しました"$'\n'"${r}"$'\n\n'
}
run "oxlint" npx --no-install oxlint --report-unused-disable-directives "$f"
run "prettier --check (直すには npx prettier --write ${f})" npx --no-install prettier --check "$f"
run "tsc --noEmit" npx --no-install tsc --noEmit

if [ -n "$out" ]; then
  printf '%s' "$out" >&2
  exit 2
fi
