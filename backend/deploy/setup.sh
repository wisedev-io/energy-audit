#!/usr/bin/env bash
set -euo pipefail

# EnergyAudit VPS setup (Ubuntu/Debian)
# - Installs system packages
# - Creates /opt/energy-audit
# - Creates venv + installs requirements
# - Installs/starts systemd service
# - Installs nginx site (HTTP only)
#
# Run on the server as root:
#   bash /opt/energy-audit/deploy/setup.sh

APP_DIR="/opt/energy-audit"
SERVICE_NAME="energy-audit"
APP_PORT="${APP_PORT:-5050}"

echo "==> Installing OS packages"
apt update
apt install -y python3 python3-venv python3-pip nginx

echo "==> Ensuring app directory exists: ${APP_DIR}"
mkdir -p "${APP_DIR}"
cd "${APP_DIR}"

if [ ! -f "requirements.txt" ]; then
  echo "ERROR: ${APP_DIR}/requirements.txt not found."
  echo "Upload/clone the project into ${APP_DIR} first."
  exit 1
fi

echo "==> Creating venv"
python3 -m venv .venv

echo "==> Installing Python dependencies"
. .venv/bin/activate
pip install -r requirements.txt

echo "==> Installing systemd service"
install -m 0644 "${APP_DIR}/deploy/${SERVICE_NAME}.service" "/etc/systemd/system/${SERVICE_NAME}.service"
systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}"

echo "==> Installing nginx site"
install -m 0644 "${APP_DIR}/deploy/nginx-${SERVICE_NAME}.conf" "/etc/nginx/sites-available/${SERVICE_NAME}"
ln -sf "/etc/nginx/sites-available/${SERVICE_NAME}" "/etc/nginx/sites-enabled/${SERVICE_NAME}"
nginx -t
systemctl reload nginx

echo ""
echo "Done."
echo "Service status:"
systemctl status "${SERVICE_NAME}" --no-pager || true
echo ""
echo "Open:"
echo "  http://<server-ip>/"
echo ""
echo "IMPORTANT: Create ${APP_DIR}/.env with DATABASE_URL before using the app."

