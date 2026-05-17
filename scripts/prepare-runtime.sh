#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_DIR="$ROOT_DIR/core/chaoxing"
RUNTIME_DIR="$ROOT_DIR/build/runtime"

if ! command -v uv >/dev/null 2>&1; then
  echo "error: uv not found. Install uv first or put it in PATH." >&2
  exit 1
fi

if [[ ! -f "$CORE_DIR/main.py" ]]; then
  echo "error: core/chaoxing is missing. Run npm run setup:core first." >&2
  exit 1
fi

UV_BIN="$(command -v uv)"
PYTHON_BIN="$(uv python find 3.13)"
PYTHON_HOME="$(cd "$(dirname "$PYTHON_BIN")/.." && pwd -P)"

echo "Preparing bundled runtime"
echo "uv: $UV_BIN"
echo "python: $PYTHON_BIN"

mkdir -p "$RUNTIME_DIR/python" "$RUNTIME_DIR/python-packages"
rm -rf "$RUNTIME_DIR/uv" "$RUNTIME_DIR/python" "$RUNTIME_DIR/python-packages"

/usr/bin/ditto "$PYTHON_HOME" "$RUNTIME_DIR/python"

(
  cd "$CORE_DIR"
  uv run --python 3.13 python -c 'import requests, bs4, lxml, loguru, tqdm, httpx; print("dependency smoke ok")'
)

SITE_PACKAGES="$CORE_DIR/.venv/lib/python3.13/site-packages"
if [[ ! -d "$SITE_PACKAGES" ]]; then
  echo "error: expected site-packages at $SITE_PACKAGES" >&2
  exit 1
fi

/usr/bin/ditto "$SITE_PACKAGES" "$RUNTIME_DIR/python-packages"
find "$RUNTIME_DIR/python-packages" -type d -name '__pycache__' -prune -exec rm -rf {} +
find "$RUNTIME_DIR/python-packages" -type d \( -iname 'tests' -o -iname 'test' \) -prune -exec rm -rf {} +
find "$RUNTIME_DIR/python-packages" -type f -name '*.pyc' -delete
rm -rf "$RUNTIME_DIR/python/include"
rm -f "$RUNTIME_DIR/python/bin/pip" "$RUNTIME_DIR/python/bin/pip3" "$RUNTIME_DIR/python/bin/pip3.13"
rm -f "$RUNTIME_DIR/python/bin/idle3.13" "$RUNTIME_DIR/python/bin/pydoc3.13"

cat > "$RUNTIME_DIR/BUILD_INFO.txt" <<EOF
created_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
uv=$(uv --version)
python=$("$RUNTIME_DIR/python/bin/python3.13" --version)
source_python=$PYTHON_HOME
EOF

echo "Runtime size:"
du -sh "$RUNTIME_DIR"
