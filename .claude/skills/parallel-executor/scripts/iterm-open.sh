#!/bin/bash
# iTerm2でセッションを開くユーティリティ
# Usage: iterm-open.sh <mode> <directory> [command]
#   mode: tab | vsplit | hsplit
#   directory: 開くディレクトリ
#   command: 実行するコマンド（省略可）

set -e

MODE="${1:-tab}"
DIR="${2:-.}"
CMD="${3:-}"

# ディレクトリの絶対パスを取得
ABS_DIR="$(cd "$DIR" 2>/dev/null && pwd || echo "$DIR")"

# コマンドがあれば cd && command、なければ cd のみ
if [ -n "$CMD" ]; then
  FULL_CMD="cd $ABS_DIR && $CMD"
else
  FULL_CMD="cd $ABS_DIR"
fi

case "$MODE" in
  tab)
    osascript -e "
      tell application \"iTerm2\"
        tell current window
          create tab with default profile
          tell current session
            write text \"$FULL_CMD\"
          end tell
        end tell
      end tell"
    ;;
  vsplit)
    osascript -e "
      tell application \"iTerm2\"
        tell current window
          tell current session
            set newSession to (split vertically with default profile)
          end tell
          tell newSession
            write text \"$FULL_CMD\"
          end tell
        end tell
      end tell"
    ;;
  hsplit)
    osascript -e "
      tell application \"iTerm2\"
        tell current window
          tell current session
            set newSession to (split horizontally with default profile)
          end tell
          tell newSession
            write text \"$FULL_CMD\"
          end tell
        end tell
      end tell"
    ;;
  *)
    echo "Unknown mode: $MODE"
    echo "Usage: $0 <tab|vsplit|hsplit> <directory> [command]"
    exit 1
    ;;
esac

echo "Opened iTerm2 ($MODE): $ABS_DIR"
