#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-dist}"
SOURCE_DIR="prototype/work"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "ソースディレクトリが見つかりません: $SOURCE_DIR" >&2
  exit 1
fi

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

rsync -av --exclude='*.map' "$SOURCE_DIR"/ "$TARGET_DIR"/

echo "Prototype deployed to $TARGET_DIR"
