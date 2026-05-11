#!/usr/bin/env bash
# deploy.sh — commit, push to GitHub, pull on server, restart service
set -euo pipefail

SERVER="root@157.180.28.98"
SSH_KEY="$HOME/.ssh/energy_audit_server"
REMOTE_DIR="/opt/energy-audit"
SERVICE="energy-audit.service"

# ── 1. Stage & commit if there are changes ─────────────────────────────────
if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git status --porcelain)" ]; then
  MSG="${1:-deploy: update}"
  echo "==> Staging all changes with message: \"$MSG\""
  git add -A
  git commit -m "$MSG"
else
  echo "==> No local changes to commit."
fi

# ── 2. Push to GitHub ───────────────────────────────────────────────────────
echo "==> Pushing to GitHub..."
git push

# ── 3. Pull on server & restart service ────────────────────────────────────
echo "==> Deploying to server $SERVER..."
ssh -i "$SSH_KEY" "$SERVER" bash -s <<EOF
  set -euo pipefail
  cd $REMOTE_DIR
  echo "--- git pull ---"
  git pull
  echo "--- restarting $SERVICE ---"
  systemctl restart $SERVICE
  echo "--- service status ---"
  systemctl is-active $SERVICE && echo "Service is running." || echo "WARNING: service not active!"
EOF

echo ""
echo "==> Deploy complete."
