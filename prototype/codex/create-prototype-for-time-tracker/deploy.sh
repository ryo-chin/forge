#!/usr/bin/env bash
set -euo pipefail

export CLOUDFLARE_API_TOKEN=ycSopvP-3byyemVBHvEOSbuDxcvHfvrFpsIIktFK

npx wrangler deploy \
      --name "test_from_local" \
      --var "BRANCH_NAME=codex/create-prototype-for-time-tracker" \

#log() {
#  echo "[deploy] $*" >&2
#}
#
#require_cmd() {
#  if ! command -v "$1" >/dev/null 2>&1; then
#    log "'$1' コマンドが見つかりません。インストールしてから再実行してください。"
#    exit 1
#  fi
#}
#
#SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#
#require_cmd node
#require_cmd npm
#require_cmd npx
#
#if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
#  log "環境変数 CLOUDFLARE_API_TOKEN が設定されていません。"
#  exit 1
#fi
#
#if [ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]; then
#  log "環境変数 CLOUDFLARE_ACCOUNT_ID が設定されていません。"
#  exit 1
#fi
#
#BRANCH_NAME_RAW=${BRANCH_NAME_RAW:-$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "prototype")}
#
#sanitize() {
#  echo "$1" \
#    | tr '[:upper:]' '[:lower:]' \
#    | sed -E 's/[^a-z0-9]+/-/g' \
#    | sed -E 's/^-+|-+$//g'
#}
#
#SANITIZED_BRANCH=${SANITIZED_BRANCH:-$(sanitize "$BRANCH_NAME_RAW")}
#if [ -z "$SANITIZED_BRANCH" ]; then
#  SANITIZED_BRANCH="prototype"
#fi
#
#cd "$SCRIPT_DIR"
#
#if [ -f package-lock.json ]; then
#  log "Installing dependencies via npm ci"
#  npm ci
#else
#  log "Installing dependencies via npm install"
#  npm install --no-fund --no-audit
#fi
#
#log "Running npm run build"
#npm run build
#
#log "Deploying with Wrangler as $SANITIZED_BRANCH"
#NPX_YES=1 npx wrangler deploy \
#  --name "$SANITIZED_BRANCH" \
#  --account-id "$CLOUDFLARE_ACCOUNT_ID" \
#  --var "BRANCH_NAME=$BRANCH_NAME_RAW"
