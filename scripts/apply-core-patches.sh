#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_DIR="$ROOT_DIR/core/chaoxing"
PATCH_DIR="$ROOT_DIR/patches"

if [[ ! -d "$CORE_DIR/.git" ]]; then
  echo "error: core/chaoxing is missing. Run npm run setup:core first." >&2
  exit 1
fi

for patch in "$PATCH_DIR"/*.patch; do
  [[ -e "$patch" ]] || continue
  if git -C "$CORE_DIR" apply --check "$patch" >/dev/null 2>&1; then
    git -C "$CORE_DIR" apply "$patch"
    echo "applied $(basename "$patch")"
  else
    echo "skip $(basename "$patch")"
  fi
done
