#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_DIR="$ROOT_DIR/core/chaoxing"
REPO_URL="https://github.com/Samueli924/chaoxing.git"
CORE_REF="6ca38cb1f730ef42ab0c738ae4a4c7859759ace0"

if [ -d "$CORE_DIR/.git" ]; then
  echo "core/chaoxing already exists."
  "$ROOT_DIR/scripts/apply-core-patches.sh"
  exit 0
fi

if [ -e "$CORE_DIR" ] && [ -n "$(find "$CORE_DIR" -mindepth 1 -maxdepth 1 2>/dev/null)" ]; then
  echo "core/chaoxing exists and is not empty. Refusing to overwrite it."
  exit 1
fi

mkdir -p "$ROOT_DIR/core"
git clone "$REPO_URL" "$CORE_DIR"
git -C "$CORE_DIR" checkout "$CORE_REF"
"$ROOT_DIR/scripts/apply-core-patches.sh"
echo "Cloned $REPO_URL to $CORE_DIR"
