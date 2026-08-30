#!/usr/bin/env bash
# Redstone World one-click launcher (macOS / Linux)
cd "$(dirname "$0")" || exit 1
PORT=8000
URL="http://localhost:$PORT"
echo "Redstone World · Launching -> $URL"

open "$URL" 2>/dev/null || xdg-open "$URL" 2>/dev/null &

if command -v python3 >/dev/null 2>&1; then exec python3 -m http.server "$PORT"
elif command -v python  >/dev/null 2>&1; then exec python  -m http.server "$PORT"
elif command -v npx     >/dev/null 2>&1; then exec npx --yes http-server -p "$PORT" -c-1
else
  echo "Python or Node not found. Please install one of them."; exit 1
fi
