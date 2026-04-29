#!/bin/bash
# Energy Audit — double-click this file to start

cd "$(dirname "$0")"

if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

PYTHON_BIN="python3"
PIP_BIN="pip3"

if [ -x ".venv/bin/python" ]; then
  PYTHON_BIN=".venv/bin/python"
  PIP_BIN=".venv/bin/pip"
fi

echo ""
echo "╔══════════════════════════════════════╗"
echo "║    ⚡  Energy Audit System           ║"
echo "╚══════════════════════════════════════╝"
echo ""

PORT="${PORT:-5050}"
HOST="${HOST:-0.0.0.0}"

# Ensure venv exists
if [ ! -x ".venv/bin/python" ]; then
  echo "  Creating virtual environment (.venv)..."
  python3 -m venv .venv || exit 1
  PYTHON_BIN=".venv/bin/python"
  PIP_BIN=".venv/bin/pip"
fi

# Ensure dependencies are installed (idempotent)
echo "  Installing/updating dependencies..."
"$PIP_BIN" install -r requirements.txt >/dev/null || exit 1

# Kill any existing server on the port
if command -v lsof >/dev/null 2>&1; then
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null
fi

# Start server in background
HOST="$HOST" PORT="$PORT" "$PYTHON_BIN" server.py &
SERVER_PID=$!

# Wait for server to be ready
sleep 1.5

# Open browser
open "http://127.0.0.1:${PORT}"

echo "  Server PID: $SERVER_PID"
echo "  Local URL: http://127.0.0.1:${PORT}"
echo ""
echo "  Network (other devices):"
echo "    1) Find this Mac's IP (Wi‑Fi): System Settings → Network → Wi‑Fi"
echo "    2) Open: http://<MAC_IP>:${PORT}"
echo "  Note: both devices must be on the same Wi‑Fi/LAN."
echo ""
echo "  Yopish uchun bu oynani yoping yoki Ctrl+C bosing."
echo ""

# Keep script alive (so closing terminal = stopping server)
wait $SERVER_PID
