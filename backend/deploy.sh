#!/bin/bash
echo "Deploying to server..."
rsync -avz --exclude '.venv' --exclude '__pycache__' --exclude '*.pyc' \
  ~/energy-audit-backend/ energy-audit-server:/opt/energy-audit/
ssh energy-audit-server "cd /opt/energy-audit && .venv/bin/pip install -q -r requirements.txt && sudo systemctl restart energy-audit"
echo "Done! Server restarted."
