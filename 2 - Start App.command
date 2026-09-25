#!/bin/bash
# Starts the app. Keep this window open while you use it; close it to stop.
cd "$(dirname "$0")" || exit 1
[ -d node_modules ] || npm ci --no-audit --no-fund
echo "Opening http://localhost:5173 ... (close this window to stop the app)"
npx vite --open /dashboard
