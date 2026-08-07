#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-$ROOT_DIR/build/software-copyright}"
SOURCE_OUTPUT="$OUTPUT_DIR/渡软件V1.0源程序鉴别材料.txt"
FILE_LIST="$OUTPUT_DIR/source-files.txt"
ALL_SOURCE="$OUTPUT_DIR/all-first-party-source.txt"

mkdir -p "$OUTPUT_DIR"

git -C "$ROOT_DIR" ls-files \
  'App.tsx' \
  'index.js' \
  'src/**/*.ts' \
  'src/**/*.tsx' \
  'android/app/src/main/java/**/*.kt' \
  'ios/duapp/**/*.h' \
  'ios/duapp/**/*.m' \
  'ios/duapp/**/*.mm' \
  'ios/duapp/**/*.swift' \
  | LC_ALL=C sort > "$FILE_LIST"

: > "$ALL_SOURCE"

while IFS= read -r relative_path; do
  [[ -z "$relative_path" ]] && continue
  {
    printf '\n/* FILE: %s */\n' "$relative_path"
    perl -ne 'print unless /^\s*$/;' "$ROOT_DIR/$relative_path"
  } >> "$ALL_SOURCE"
done < "$FILE_LIST"

total_lines="$(wc -l < "$ALL_SOURCE" | tr -d ' ')"
required_lines=3000

if (( total_lines <= required_lines )); then
  cp "$ALL_SOURCE" "$SOURCE_OUTPUT"
else
  {
    printf '渡软件 V1.0 源程序鉴别材料\n'
    printf '前 30 页：每页 50 行，共 1500 行\n'
    printf '后 30 页：每页 50 行，共 1500 行\n'
    printf '生成日期：%s\n\n' "$(date '+%Y-%m-%d')"
    perl -ne 'print if $. <= 1500' "$ALL_SOURCE"
    printf '\n/* 后 30 页开始 */\n'
    perl -ne "print if \$. > $((total_lines - 1500))" "$ALL_SOURCE"
  } > "$SOURCE_OUTPUT"
fi

printf 'Generated %s (%s source lines inspected)\n' \
  "$SOURCE_OUTPUT" \
  "$total_lines"
