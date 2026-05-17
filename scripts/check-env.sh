#!/usr/bin/env bash
set -euo pipefail

missing=0

check_command() {
  local name="$1"
  local hint="$2"

  if command -v "$name" >/dev/null 2>&1; then
    echo "ok: $name -> $("$name" --version 2>/dev/null | head -n 1)"
  else
    echo "missing: $name ($hint)"
    missing=1
  fi
}

check_command node "install Node.js"
check_command npm "install npm"
check_command uv "brew install uv"

if command -v uv >/dev/null 2>&1; then
  if uv python find 3.13 >/dev/null 2>&1; then
    echo "ok: Python 3.13 -> $(uv python find 3.13)"
  else
    echo "missing: Python 3.13 (uv python install 3.13)"
    missing=1
  fi
fi

if [ "$missing" -ne 0 ]; then
  exit 1
fi

echo "Environment check passed."
